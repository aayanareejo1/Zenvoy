import React, { useRef, useState } from 'react';
import {
  Animated, ActivityIndicator, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { parseReceiptWithVision }    from '../services/claude';
import { preprocessImage, isTooLarge } from '../services/imageProcessor';
import { insertReceipt, getMonthlyCount, deriveStatus } from '../services/db';
import { syncReceiptToFirestore }    from '../services/firestore';
import { useApp }                    from '../context/AppContext';
import { useToast }                  from '../context/ToastContext';
import Sheet, { SheetOption }        from '../components/Sheet';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, CATEGORIES } from '../constants/theme';
import { FREE_MONTHLY_LIMIT }        from '../constants/config';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const checkScanLimit = async (isPro) => {
  if (isPro) return true;
  const count = await getMonthlyCount();
  return count < FREE_MONTHLY_LIMIT;
};

// Animated press wrapper used for primary CTA
function PressableScale({ children, style, onPress, activeScale = 0.97 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: activeScale, damping: 20, stiffness: 400, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,           damping: 20, stiffness: 300, useNativeDriver: true }).start();
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
        style={{ width: '100%' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ScanScreen({ navigation }) {
  const { user, isPro } = useApp();
  const { showToast }   = useToast();

  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [vendor, setVendor]     = useState('');
  const [date, setDate]         = useState('');
  const [total, setTotal]       = useState('');
  const [tax, setTax]           = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes]       = useState([]);

  // Sheet visibility
  const [sourceSheet,   setSourceSheet]   = useState(false);
  const [multiSheet,    setMultiSheet]    = useState(false);
  const [tooLargeSheet, setTooLargeSheet] = useState(false);
  const [paywallSheet,  setPaywallSheet]  = useState(false);
  const [againSheet,    setAgainSheet]    = useState(false);

  const againResolveRef = useRef(null);

  // ── Paywall ────────────────────────────────────────────────────────────────

  const gateScan = async () => {
    const allowed = await checkScanLimit(isPro);
    if (!allowed) { setPaywallSheet(true); return false; }
    return true;
  };

  // ── Single scan ────────────────────────────────────────────────────────────

  const handleScan = () => setSourceSheet(true);

  const pickSingle = async (source) => {
    setSourceSheet(false);
    if (!(await gateScan())) return;

    const opts = { mediaTypes: ['images'], quality: 1, allowsEditing: true };
    let picked;
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Camera permission denied', type: 'error' }); return; }
        picked = await ImagePicker.launchCameraAsync(opts);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Photo library permission denied', type: 'error' }); return; }
        picked = await ImagePicker.launchImageLibraryAsync(opts);
      }
    } catch (e) { showToast({ message: e.message, type: 'error' }); return; }

    if (!picked || picked.canceled) return;
    await processSingle(picked.assets[0].uri);
  };

  const processSingle = async (rawUri) => {
    setLoading(true);
    setResult(null);
    try {
      const { uri, size } = await preprocessImage(rawUri);
      if (isTooLarge(size)) { setLoading(false); setTooLargeSheet(true); return; }

      const parsed = await parseReceiptWithVision(uri);

      if (parsed._tokenWarning) {
        showToast({ message: 'Tip: crop closer to the receipt text to use fewer tokens.', type: 'info' });
      }

      setResult({ ...parsed, photo_uri: uri });
      setVendor(parsed.vendor || '');
      setDate(parsed.date || '');
      setTotal(parsed.total ? String(parsed.total) : '');
      setTax(parsed.tax && parsed.tax !== '0.00' ? String(parsed.tax) : '');
      setCategory(parsed.category || 'Other');
      setNotes(parsed.notes || []);
    } catch (e) {
      showToast({ message: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ── Multi scan ─────────────────────────────────────────────────────────────

  const handleMultiScan = async () => {
    if (!(await gateScan())) return;
    setMultiSheet(true);
  };

  const askCaptureAgain = () =>
    new Promise(resolve => {
      againResolveRef.current = resolve;
      setAgainSheet(true);
    });

  const resolveAgain = (value) => {
    setAgainSheet(false);
    againResolveRef.current?.(value);
    againResolveRef.current = null;
  };

  const doMultiScan = async (source) => {
    let assets = [];
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Camera permission denied', type: 'error' }); return; }
        while (true) {
          const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true });
          if (picked.canceled) break;
          assets.push(picked.assets[0]);
          const again = await askCaptureAgain();
          if (!again) break;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Photo library permission denied', type: 'error' }); return; }
        const picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsMultipleSelection: true,
        });
        if (picked.canceled) return;
        assets = picked.assets;
      }
    } catch (e) { showToast({ message: e.message, type: 'error' }); return; }

    if (assets.length === 0) return;

    const count     = await getMonthlyCount();
    const remaining = isPro ? Infinity : FREE_MONTHLY_LIMIT - count;
    if (remaining <= 0) { setPaywallSheet(true); return; }

    const toProcess = isPro ? assets : assets.slice(0, remaining);
    if (toProcess.length < assets.length) {
      showToast({
        message: `Only ${remaining} scan${remaining !== 1 ? 's' : ''} left this month — processing first ${remaining}.`,
        type: 'warning',
      });
    }

    setLoading(true);
    const now = new Date().toISOString();
    const queueItems = [];
    for (const asset of toProcess) {
      const id = await insertReceipt({
        vendor: null, date: null, total: 0, tax: 0,
        category: 'Other', status: 'needs_review',
        notes: ['Queued for processing'],
        photo_uri: asset.uri,
        created_at: now,
      });
      queueItems.push({ id, photoUri: asset.uri });
    }
    setLoading(false);
    navigation.navigate('Processing', { items: queueItems });
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = new Date().toISOString();
    const receipt = {
      vendor:    vendor.trim() || null,
      date:      date.trim()   || null,
      total:     parseFloat(total) || 0,
      tax:       parseFloat(tax)   || 0,
      category,
      notes,
      photo_uri:  result?.photo_uri || null,
      created_at: now,
    };
    receipt.status = deriveStatus(receipt);

    await insertReceipt(receipt);
    if (isPro && user) await syncReceiptToFirestore(user.uid, receipt);
    setResult(null);

    if (receipt.status === 'needs_review') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast({
        message: 'Saved to Inbox — some fields were missing.',
        type: 'warning',
        action: { label: 'View', onPress: () => navigation.navigate('Inbox') },
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: 'Receipt saved!',
        type: 'success',
        action: { label: 'View', onPress: () => navigation.navigate('Receipts') },
      });
    }
  };

  // ── Render: Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.loadingCard}>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
          <Text style={styles.loadingTitle}>Analyzing receipt</Text>
          <Text style={styles.loadingSubtext}>This usually takes a few seconds</Text>
        </View>
      </View>
    );
  }

  // ── Render: Result (Review & Save) ────────────────────────────────────────

  if (result) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.reviewHeading}>Review & Save</Text>
        <Text style={styles.reviewSubtext}>Verify the details before saving</Text>

        <Field label="Vendor" value={vendor} onChange={setVendor} warn={!vendor} />
        <Field label="Date"   value={date}   onChange={setDate}   warn={!date} />
        <Field label="Total"  value={total}  onChange={setTotal}  warn={!total} prefix="$" keyboardType="decimal-pad" />
        <Field label="Tax"    value={tax}    onChange={setTax}    warn={false}  prefix="$" keyboardType="decimal-pad" />

        <Text style={styles.sectionLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, { borderColor: cat.color + '80' }, category === cat.key && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[styles.categoryChipText, category === cat.key && styles.categoryChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {notes.length > 0 && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>AI Notes</Text>
            {notes.map((n, i) => <Text key={i} style={styles.noteText}>· {n}</Text>)}
          </View>
        )}

        {/* Save CTA with glow */}
        <View style={styles.glowWrap}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.9}>
            <Text style={styles.saveBtnText}>Save Receipt</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => setResult(null)} activeOpacity={0.7}>
          <Text style={styles.cancelBtnText}>Discard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Render: Hero (Idle) ───────────────────────────────────────────────────

  return (
    <View style={[styles.container, styles.center]}>

      {/* ── Sheets ──────────────────────────────────────────────────────── */}

      <Sheet visible={sourceSheet} onClose={() => setSourceSheet(false)} title="Scan Receipt">
        <SheetOption icon="📷" label="Take Photo"    sublabel="Use your camera"          onPress={() => pickSingle('camera')}  />
        <SheetOption icon="🖼️" label="Choose Photo"  sublabel="Pick from library"         onPress={() => pickSingle('gallery')} last />
      </Sheet>

      <Sheet visible={multiSheet} onClose={() => setMultiSheet(false)} title="Multi Scan">
        <SheetOption icon="📷" label="Camera"        sublabel="Capture one at a time"     onPress={() => { setMultiSheet(false); doMultiScan('camera');  }} />
        <SheetOption icon="🖼️" label="Photo Library" sublabel="Select multiple at once"   onPress={() => { setMultiSheet(false); doMultiScan('gallery'); }} last />
      </Sheet>

      <Sheet visible={tooLargeSheet} onClose={() => setTooLargeSheet(false)} title="Image Too Large">
        <Text style={sheet.body}>
          The photo couldn't be compressed enough. Try cropping tighter or retaking closer to the receipt.
        </Text>
        <SheetOption icon="📷" label="Retake / Recrop" onPress={() => { setTooLargeSheet(false); setSourceSheet(true); }} />
        <SheetOption icon="✏️" label="Enter Manually"  onPress={() => { setTooLargeSheet(false); setResult({ photo_uri: null }); }} last />
      </Sheet>

      <Sheet visible={paywallSheet} onClose={() => setPaywallSheet(false)} title="Monthly Limit Reached">
        <Text style={sheet.body}>
          Free accounts can scan {FREE_MONTHLY_LIMIT} receipts per month.{'\n'}Upgrade to Pro for unlimited scans and cloud backup.
        </Text>
        <View style={sheet.glowWrap}>
          <TouchableOpacity style={sheet.upgradeBtn} onPress={() => { setPaywallSheet(false); navigation.navigate('Account'); }} activeOpacity={0.9}>
            <Text style={sheet.upgradeTxt}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={sheet.cancelOption} onPress={() => setPaywallSheet(false)} activeOpacity={0.7}>
          <Text style={sheet.cancelTxt}>Maybe later</Text>
        </TouchableOpacity>
      </Sheet>

      <Sheet visible={againSheet} onClose={() => resolveAgain(false)} title="Receipt added">
        <SheetOption icon="➕" label="Capture another" onPress={() => resolveAgain(true)}  />
        <SheetOption icon="✅" label="Done scanning"   onPress={() => resolveAgain(false)} last />
      </Sheet>

      {/* ── Hero content ────────────────────────────────────────────────── */}

      <View style={styles.heroSection}>
        <Text style={styles.logo}>Zenvoy</Text>
        <Text style={styles.tagline}>Receipts, organized.</Text>
      </View>

      <View style={styles.ctaSection}>
        {/* Primary CTA — teal glow */}
        <PressableScale style={styles.glowWrap} onPress={handleScan}>
          <View style={styles.scanBtn}>
            <Text style={styles.scanBtnIcon}>⬡</Text>
            <Text style={styles.scanBtnText}>Scan Receipt</Text>
          </View>
        </PressableScale>

        {/* Divider */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        {/* Secondary CTA */}
        <TouchableOpacity style={styles.multiBtn} onPress={handleMultiScan} activeOpacity={0.75}>
          <Text style={styles.multiBtnText}>⚡  Multi Scan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, warn, prefix, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, warn && styles.inputWarn]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType || 'default'}
          placeholderTextColor={COLORS.textTertiary}
          placeholder={`Enter ${label.toLowerCase()}`}
          selectionColor={COLORS.accent}
        />
      </View>
      {warn && <Text style={styles.warnText}>Not detected — please enter manually</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  center:      { justifyContent: 'center', alignItems: 'center' },

  // ── Hero layout
  heroSection: { alignItems: 'center', marginBottom: SPACE.huge },
  logo:        { fontSize: 42, fontWeight: '800', color: COLORS.accent, letterSpacing: -1.5, marginBottom: 10 },
  tagline:     { fontSize: 16, color: COLORS.textSecondary, fontWeight: '400', letterSpacing: 0.2 },

  ctaSection:  { width: '100%', gap: 0 },
  bottomSpacer:{ height: SPACE.huge },

  // ── Glow wrapper (iOS colored shadow, Android elevation)
  glowWrap: {
    width: '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },

  // ── Primary scan button
  scanBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             10,
  },
  scanBtnIcon: { fontSize: 20 },
  scanBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.bg, letterSpacing: -0.3 },

  // ── Divider
  orRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: SPACE.lg },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  orText: { fontSize: 13, color: COLORS.textTertiary, fontWeight: '500', marginHorizontal: SPACE.md },

  // ── Secondary multi-scan
  multiBtn: {
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.borderStrong,
    backgroundColor: COLORS.cardAlt,
  },
  multiBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },

  // ── Loading state
  loadingCard: {
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.xl,
    padding:         SPACE.xxxl,
    width:           '80%',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    gap:             SPACE.sm,
    ...ELEVATION.card,
  },
  spinnerWrap: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: COLORS.accentMuted,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.md,
  },
  loadingTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  loadingSubtext: { fontSize: 14, color: COLORS.textSecondary },

  // ── Review / result state
  scrollContent:   { paddingVertical: SPACE.xxl, paddingBottom: 40 },
  reviewHeading:   { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.5, marginBottom: 4 },
  reviewSubtext:   { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACE.xxl },

  field:       { marginBottom: SPACE.lg },
  sectionLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.6,
                  textTransform: 'uppercase', marginBottom: SPACE.sm },
  fieldLabel:  { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.6,
                 textTransform: 'uppercase', marginBottom: SPACE.sm },
  inputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.input,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACE.md,
  },
  inputWarn:   { borderColor: COLORS.warning },
  prefix:      { color: COLORS.textSecondary, fontSize: 16, marginRight: SPACE.xs },
  input:       { flex: 1, height: 48, color: COLORS.textPrimary, fontSize: 16 },
  warnText:    { fontSize: 12, color: COLORS.warning, marginTop: SPACE.xs, fontWeight: '500' },

  categoryScroll:         { marginBottom: SPACE.sm },
  categoryContent:        { paddingBottom: SPACE.sm, gap: SPACE.sm, flexDirection: 'row' },
  categoryChip: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: SPACE.md,
    paddingVertical: 8,
    borderRadius:    RADIUS.chip,
    borderWidth:     1.5,
    backgroundColor: 'transparent',
    gap:             6,
  },
  categoryEmoji:          { fontSize: 15 },
  categoryChipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },

  notesBox: {
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.md,
    padding:         SPACE.md,
    marginBottom:    SPACE.lg,
    gap:             SPACE.xs,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  notesLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.5,
                textTransform: 'uppercase', marginBottom: SPACE.xs },
  noteText: { fontSize: 13, color: COLORS.warning, lineHeight: 19 },

  saveBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.xxl,
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.bg, letterSpacing: -0.2 },

  cancelBtn: {
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.sm,
  },
  cancelBtnText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
});

// Styles inside Sheet content (paywall / tooLarge)
const sheet = StyleSheet.create({
  body: {
    fontSize:        15,
    color:           COLORS.textSecondary,
    lineHeight:      22,
    marginBottom:    SPACE.xl,
    textAlign:       'center',
    paddingHorizontal: SPACE.xs,
  },
  glowWrap: {
    width:        '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  upgradeBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.xs,
  },
  upgradeTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  cancelOption: {
    height:          BTN_HEIGHT,
    justifyContent:  'center',
    alignItems:      'center',
  },
  cancelTxt: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
});
