import React, { useRef, useState, useEffect } from 'react';
import {
  Animated, ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { parseReceiptWithVision }      from '../services/claude';
import { preprocessImage, isTooLarge } from '../services/imageProcessor';
import { insertReceipt, getLatestReceipt, getMonthlyCount, deriveStatus } from '../services/db';
import { syncReceiptToFirestore }      from '../services/firestore';
import { useApp }                      from '../context/AppContext';
import { useToast }                    from '../context/ToastContext';
import Sheet, { SheetOption }          from '../components/Sheet';
import RowInput                        from '../components/RowInput';
import {
  COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, CATEGORIES,
} from '../constants/theme';
import { FREE_MONTHLY_LIMIT } from '../constants/config';

// ─── Business helpers (unchanged) ─────────────────────────────────────────────

const checkScanLimit = async (isPro) => {
  if (isPro) return true;
  const count = await getMonthlyCount();
  return count < FREE_MONTHLY_LIMIT;
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

// Pressable with spring scale + optional haptic on tap
function PressableScale({ children, style, onPress, activeScale = 0.97, haptic = 'medium' }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: activeScale, damping: 20, stiffness: 400, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,           damping: 20, stiffness: 300, useNativeDriver: true }).start();
  const handlePress = () => {
    if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity onPress={handlePress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} style={{ width: '100%' }}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Section label above groups
function SectionLabel({ children }) {
  return <Text style={sl.text}>{children}</Text>;
}
const sl = StyleSheet.create({
  text: {
    fontSize: 11, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: SPACE.sm, marginTop: SPACE.xs,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScanScreen({ navigation }) {
  const { user, isPro } = useApp();
  const { showToast }   = useToast();

  // ── State ────────────────────────────────────────────────────────────────

  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);
  const [result,  setResult]    = useState(null);
  const [vendor,  setVendor]    = useState('');
  const [date,    setDate]      = useState('');
  const [total,   setTotal]     = useState('');
  const [tax,     setTax]       = useState('');
  const [category, setCategory] = useState('Other');
  const [notes,   setNotes]     = useState([]);
  const [lastReceipt, setLastReceipt] = useState(null);

  // Sheets
  const [tooLargeSheet, setTooLargeSheet] = useState(false);
  const [paywallSheet,  setPaywallSheet]  = useState(false);
  const [multiSheet,    setMultiSheet]    = useState(false);
  const [againSheet,    setAgainSheet]    = useState(false);
  const againResolveRef = useRef(null);

  // Load most recent receipt for the bottom card (refreshes after save/discard)
  useEffect(() => {
    getLatestReceipt().then(setLastReceipt).catch(() => setLastReceipt(null));
  }, [result]);

  // ── Paywall ──────────────────────────────────────────────────────────────

  const gateScan = async () => {
    const allowed = await checkScanLimit(isPro);
    if (!allowed) { setPaywallSheet(true); return false; }
    return true;
  };

  // ── Single scan ──────────────────────────────────────────────────────────

  const pickSingle = async (source) => {
    if (!(await gateScan())) return;
    const opts = { mediaTypes: ['images'], quality: 1, allowsEditing: true };
    let picked;
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Camera access denied. Enable it in Settings.', type: 'error' }); return; }
        picked = await ImagePicker.launchCameraAsync(opts);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Photo library access denied. Enable it in Settings.', type: 'error' }); return; }
        picked = await ImagePicker.launchImageLibraryAsync(opts);
      }
    } catch (e) { showToast({ message: e.message, type: 'error' }); return; }

    if (!picked || picked.canceled) return;
    await processSingle(picked.assets[0].uri);
  };

  const processSingle = async (rawUri) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { uri, size } = await preprocessImage(rawUri);
      if (isTooLarge(size)) { setLoading(false); setTooLargeSheet(true); return; }

      const parsed = await parseReceiptWithVision(uri);

      if (parsed._tokenWarning) {
        showToast({ message: 'Tip: crop closer to the receipt text to use fewer tokens.', type: 'info' });
      }

      setResult({ ...parsed, photo_uri: uri });
      setVendor(parsed.vendor   || '');
      setDate(parsed.date       || '');
      setTotal(parsed.total     ? String(parsed.total) : '');
      setTax(parsed.tax && parsed.tax !== '0.00' ? String(parsed.tax) : '');
      setCategory(parsed.category || 'Other');
      setNotes(parsed.notes     || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Multi scan ───────────────────────────────────────────────────────────

  const handleMultiScan = async () => {
    if (!(await gateScan())) return;
    setMultiSheet(true);
  };

  const askCaptureAgain = () =>
    new Promise(resolve => { againResolveRef.current = resolve; setAgainSheet(true); });

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
        if (status !== 'granted') { showToast({ message: 'Camera access denied. Enable it in Settings.', type: 'error' }); return; }
        while (true) {
          const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true });
          if (picked.canceled) break;
          assets.push(picked.assets[0]);
          const again = await askCaptureAgain();
          if (!again) break;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast({ message: 'Photo library access denied. Enable it in Settings.', type: 'error' }); return; }
        const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true });
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

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = new Date().toISOString();
    const receipt = {
      vendor:     vendor.trim() || null,
      date:       date.trim()   || null,
      total:      parseFloat(total) || 0,
      tax:        parseFloat(tax)   || 0,
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

  // ── Shared sheets ─────────────────────────────────────────────────────────

  const Sheets = (
    <>
      <Sheet visible={tooLargeSheet} onClose={() => setTooLargeSheet(false)} title="Image Too Large">
        <Text style={s.sheetBody}>
          The photo couldn't be compressed enough. Crop tighter or retake closer to the receipt.
        </Text>
        <SheetOption icon="📷" label="Try Again"      onPress={() => { setTooLargeSheet(false); pickSingle('camera'); }} />
        <SheetOption icon="✏️" label="Enter Manually" onPress={() => { setTooLargeSheet(false); setResult({ photo_uri: null }); }} last />
      </Sheet>

      <Sheet visible={paywallSheet} onClose={() => setPaywallSheet(false)} title="Monthly Limit Reached">
        <Text style={s.sheetBody}>
          Free accounts get {FREE_MONTHLY_LIMIT} scans per month.{'\n'}Upgrade to Pro for unlimited scans and cloud backup.
        </Text>
        <View style={s.sheetGlow}>
          <TouchableOpacity style={s.sheetPrimaryBtn} onPress={() => { setPaywallSheet(false); navigation.navigate('Account'); }} activeOpacity={0.9}>
            <Text style={s.sheetPrimaryTxt}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.sheetGhostBtn} onPress={() => setPaywallSheet(false)} activeOpacity={0.7}>
          <Text style={s.sheetGhostTxt}>Maybe later</Text>
        </TouchableOpacity>
      </Sheet>

      <Sheet visible={multiSheet} onClose={() => setMultiSheet(false)} title="Multi Scan">
        <SheetOption icon="📷" label="Camera"        sublabel="Capture one at a time"   onPress={() => { setMultiSheet(false); doMultiScan('camera');  }} />
        <SheetOption icon="🖼️" label="Photo Library" sublabel="Select multiple images"   onPress={() => { setMultiSheet(false); doMultiScan('gallery'); }} last />
      </Sheet>

      <Sheet visible={againSheet} onClose={() => resolveAgain(false)} title="Receipt added">
        <SheetOption icon="➕" label="Capture another" onPress={() => resolveAgain(true)}  />
        <SheetOption icon="✅" label="Done scanning"   onPress={() => resolveAgain(false)} last />
      </Sheet>
    </>
  );

  // ── Render: Processing ────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.screen}>
        {Sheets}
        <ScreenHeader title="Scanning" subtitle="Reading your receipt" />
        <View style={s.heroArea}>
          <View style={s.heroCard}>
            <View style={s.processingSpinnerWrap}>
              <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
            <Text style={s.processingTitle}>Analyzing receipt</Text>
            <Text style={s.processingSubtext}>This usually takes a few seconds</Text>
          </View>
        </View>
        <View style={s.bottomArea} />
      </View>
    );
  }

  // ── Render: Error ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={s.screen}>
        {Sheets}
        <ScreenHeader title="Zenvoy" subtitle="Receipts, organized." />
        <View style={s.heroArea}>
          <View style={s.heroCard}>
            <View style={s.errorIconWrap}>
              <Text style={s.errorIconText}>✕</Text>
            </View>
            <Text style={s.errorTitle}>Couldn't read this receipt</Text>
            <Text style={s.errorMessage} numberOfLines={3}>{error}</Text>
            <TouchableOpacity style={s.errorRetryBtn} onPress={() => { setError(null); pickSingle('camera'); }} activeOpacity={0.8}>
              <Text style={s.errorRetryTxt}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setError(null); setResult({ photo_uri: null }); }} activeOpacity={0.7}>
              <Text style={s.errorManualTxt}>Enter manually instead</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.bottomArea} />
      </View>
    );
  }

  // ── Render: Review & Save ─────────────────────────────────────────────────

  if (result) {
    const missing = !vendor || !date || !total;
    return (
      <View style={s.screen}>
        {Sheets}
        <ScrollView
          style={s.reviewScroll}
          contentContainerStyle={s.reviewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.reviewHeader}>
            <Text style={s.reviewTitle}>Review & Save</Text>
            <Text style={s.reviewSubtitle}>
              {missing ? 'Some fields need attention' : 'Looks good — ready to save'}
            </Text>
          </View>

          {/* Details card */}
          <SectionLabel>Receipt Details</SectionLabel>
          <View style={s.detailsCard}>
            <RowInput label="Vendor" value={vendor} onChange={setVendor} warn={!vendor} />
            <RowInput label="Date"   value={date}   onChange={setDate}   warn={!date}   />
            <RowInput label="Total"  value={total}  onChange={setTotal}  warn={!total}  prefix="$" keyboardType="decimal-pad" />
            <RowInput label="Tax"    value={tax}    onChange={setTax}                   prefix="$" keyboardType="decimal-pad" last />
          </View>

          {/* Category */}
          <SectionLabel>Category</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  s.chip,
                  { borderColor: cat.color + '70' },
                  category === cat.key && {
                    backgroundColor: cat.color,
                    borderColor:     cat.color,
                    elevation:       4,
                    shadowColor:     cat.color,
                    shadowOpacity:   0.4,
                    shadowOffset:    { width: 0, height: 2 },
                    shadowRadius:    8,
                  },
                ]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCategory(cat.key); }}
                activeOpacity={0.75}
              >
                <Text style={s.chipEmoji}>{cat.emoji}</Text>
                <Text style={[s.chipText, category === cat.key && s.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* AI notes */}
          {notes.length > 0 && (
            <>
              <SectionLabel>AI Notes</SectionLabel>
              <View style={s.notesCard}>
                {notes.map((n, i) => (
                  <Text key={i} style={s.noteRow}>· {n}</Text>
                ))}
              </View>
            </>
          )}

          {/* Actions */}
          <PressableScale style={[s.saveGlow, { marginTop: SPACE.xl }]} onPress={handleSave} haptic={null}>
            <View style={s.saveBtn}>
              <Text style={s.saveBtnTxt}>Save Receipt</Text>
            </View>
          </PressableScale>
          <TouchableOpacity style={s.discardBtn} onPress={() => setResult(null)} activeOpacity={0.7}>
            <Text style={s.discardTxt}>Discard</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Render: Idle ──────────────────────────────────────────────────────────

  return (
    <View style={s.screen}>
      {Sheets}

      {/* Header */}
      <ScreenHeader title="Zenvoy" subtitle="Receipts, organized." />

      {/* Hero area — top-aligned with subtle background glow */}
      <View style={s.heroArea}>
        <View style={s.heroAreaGlow} pointerEvents="none" />
        <View style={s.heroCard}>
          <View style={s.heroIconWrap}>
            <ReceiptIconGraphic />
          </View>
          <Text style={s.heroCardTitle}>Scan a receipt</Text>
          <Text style={s.heroCardBody}>
            Point at any receipt for instant data extraction.
          </Text>
        </View>
      </View>

      {/* CTA + secondary actions */}
      <View style={s.bottomArea}>

        {/* Primary: Scan (camera) */}
        <PressableScale style={s.primaryGlow} onPress={() => pickSingle('camera')}>
          <View style={s.primaryBtn}>
            <Text style={s.primaryBtnTxt}>Scan Receipt</Text>
          </View>
        </PressableScale>

        {/* Secondary: Import from Photos — link-row style */}
        <TouchableOpacity style={s.importRow} onPress={() => pickSingle('gallery')} activeOpacity={0.7}>
          <View style={s.importIconDot}>
            <Text style={s.importIconChar}>↑</Text>
          </View>
          <Text style={s.importRowLabel}>Import from Photos</Text>
        </TouchableOpacity>

        {/* Tertiary row */}
        <View style={s.tertiaryRow}>
          <TouchableOpacity onPress={handleMultiScan} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.tertiaryLink}>Batch scan  ›</Text>
          </TouchableOpacity>
        </View>

        {/* Recent receipt card, or tip card if no receipts yet */}
        {lastReceipt ? (
          <TouchableOpacity style={s.lastScanCard} onPress={() => navigation.navigate('Receipts')} activeOpacity={0.8}>
            <View style={s.lastScanLeft}>
              <Text style={s.lastScanLabel}>Recent</Text>
              <Text style={s.lastScanVendor} numberOfLines={1}>{lastReceipt.vendor || 'Unknown vendor'}</Text>
            </View>
            <View style={s.lastScanRight}>
              {parseFloat(lastReceipt.total) > 0 && (
                <Text style={s.lastScanTotal}>${parseFloat(lastReceipt.total).toFixed(2)}</Text>
              )}
              <Text style={s.lastScanChevron}>›</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={s.tipCard}>
            <View style={s.tipBubble}>
              <Text style={s.tipBubbleTxt}>i</Text>
            </View>
            <Text style={s.tipText}>Crop tight to the receipt for best results</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScreenHeader({ title, subtitle }) {
  return (
    <View style={s.header}>
      <Text style={s.headerTitle}>{title}</Text>
      <Text style={s.headerSubtitle}>{subtitle}</Text>
    </View>
  );
}

// Geometric receipt icon — no emoji, no deps
function ReceiptIconGraphic() {
  return (
    <View style={s.receiptOuter}>
      <View style={s.receiptInner}>
        <View style={[s.rLine, { width: '82%' }]} />
        <View style={[s.rLine, { width: '60%' }]} />
        <View style={[s.rLine, { width: '72%' }]} />
        <View style={s.rDivider} />
        <View style={[s.rLine, { width: '48%', backgroundColor: COLORS.accent, alignSelf: 'flex-end' }]} />
        <View style={[s.rLine, { width: '32%', backgroundColor: COLORS.accent + '60', alignSelf: 'flex-end' }]} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Layout skeleton
  screen: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },

  header: {
    paddingHorizontal: H_PAD,
    paddingTop:        SPACE.xl,
    paddingBottom:     SPACE.md,
  },
  headerTitle: {
    fontSize:      22,
    fontWeight:    '800',
    color:         COLORS.accent,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize:   13,
    color:      COLORS.textSecondary,
    marginTop:  2,
    fontWeight: '400',
  },

  // Hero area — top-aligned, not centered
  heroArea: {
    flex:              1,
    paddingHorizontal: H_PAD,
    paddingTop:        SPACE.xxl,
    overflow:          'hidden',
  },

  // Extremely faint accent arch behind the card
  heroAreaGlow: {
    position:              'absolute',
    top:                   0,
    left:                  0,
    right:                 0,
    height:                180,
    backgroundColor:       COLORS.accentMuted,  // rgba(0,196,160,0.09)
    borderBottomLeftRadius:  140,
    borderBottomRightRadius: 140,
  },

  bottomArea: {
    paddingHorizontal: H_PAD,
    paddingBottom:     SPACE.xxl,
    paddingTop:        SPACE.md,
    gap:               SPACE.sm,
  },

  // ── Hero card
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.xl,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.accent + '18',     // subtle accent tint
    padding:         SPACE.xxxl,
    alignItems:      'center',
    gap:             SPACE.sm,
    ...ELEVATION.card,
  },

  heroIconWrap: {
    marginBottom: SPACE.md,
  },

  // Receipt graphic
  receiptOuter: {
    width:           64,
    height:          76,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.cardAlt,
    borderWidth:     1,
    borderColor:     COLORS.borderStrong,
    padding:         10,
    justifyContent:  'space-between',
    overflow:        'hidden',
  },
  receiptInner: {
    flex:           1,
    justifyContent: 'space-evenly',
  },
  rLine: {
    height:          3,
    backgroundColor: COLORS.borderStrong,
    borderRadius:    2,
  },
  rDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical:  4,
  },

  heroCardTitle: {
    fontSize:      20,
    fontWeight:    '700',
    color:         COLORS.textPrimary,
    letterSpacing: -0.3,
    textAlign:     'center',
  },
  heroCardBody: {
    fontSize:   14,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },

  // ── Primary CTA — glow + border highlight
  primaryGlow: {
    width:        '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.accent + '55',   // soft highlight rim
  },
  primaryBtnTxt: {
    fontSize:      17,
    fontWeight:    '700',
    color:         COLORS.bg,
    letterSpacing: -0.2,
  },

  // ── Secondary: Import from Photos — link-row style (clear hierarchy below primary)
  importRow: {
    flexDirection:   'row',
    alignItems:      'center',
    height:          46,
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.button,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACE.lg,
    gap:             SPACE.sm,
  },
  importIconDot: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: COLORS.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  importIconChar: {
    fontSize:   13,
    fontWeight: '600',
    color:      COLORS.textSecondary,
    lineHeight: 16,
  },
  importRowLabel: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    color:      COLORS.textSecondary,
  },

  // ── Tertiary: Batch scan
  tertiaryRow: {
    alignItems:      'center',
    paddingVertical: SPACE.xs,
  },
  tertiaryLink: {
    fontSize:   13,
    color:      COLORS.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // ── Recent receipt card
  lastScanCard: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    paddingVertical:   SPACE.md,
    paddingHorizontal: SPACE.md,
    marginTop:       SPACE.xs,
  },
  lastScanLeft:   { flex: 1, gap: 3, marginRight: SPACE.md },
  lastScanLabel: {
    fontSize:      10,
    fontWeight:    '600',
    color:         COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  lastScanVendor: {
    fontSize:   14,
    fontWeight: '600',
    color:      COLORS.textSecondary,
  },
  lastScanRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACE.sm,
  },
  lastScanTotal: {
    fontSize:   14,
    fontWeight: '700',
    color:      COLORS.accent,
  },
  lastScanChevron: {
    fontSize:   16,
    color:      COLORS.textTertiary,
    lineHeight: 20,
  },

  // ── Tip card (shown when no receipts yet)
  tipCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    paddingVertical:   SPACE.md,
    paddingHorizontal: SPACE.md,
    gap:             SPACE.sm,
    marginTop:       SPACE.xs,
  },
  tipBubble: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: COLORS.border,
    justifyContent:  'center',
    alignItems:      'center',
  },
  tipBubbleTxt: {
    fontSize:   11,
    fontWeight: '700',
    color:      COLORS.textTertiary,
    lineHeight: 14,
  },
  tipText: {
    flex:       1,
    fontSize:   13,
    color:      COLORS.textSecondary,
    lineHeight: 18,
    fontWeight: '400',
  },

  // ── Processing state
  processingSpinnerWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: COLORS.accentMuted,
    borderWidth:     1,
    borderColor:     COLORS.accent + '30',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.md,
  },
  processingTitle: {
    fontSize:      20,
    fontWeight:    '700',
    color:         COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  processingSubtext: {
    fontSize:  14,
    color:     COLORS.textSecondary,
    textAlign: 'center',
  },

  // ── Error state
  errorIconWrap: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: COLORS.dangerMuted,
    borderWidth:     1,
    borderColor:     COLORS.danger + '30',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.md,
  },
  errorIconText:  { fontSize: 24, fontWeight: '700', color: COLORS.danger },
  errorTitle:     { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  errorMessage:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  errorRetryBtn: {
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.borderStrong,
    borderRadius:    RADIUS.button,
    paddingVertical:   12,
    paddingHorizontal: SPACE.xxxl,
    marginTop:       SPACE.md,
  },
  errorRetryTxt:  { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  errorManualTxt: {
    fontSize:   13,
    color:      COLORS.textTertiary,
    fontWeight: '500',
    marginTop:  SPACE.md,
  },

  // ── Review state
  reviewScroll:  { flex: 1, backgroundColor: COLORS.bg },
  reviewContent: {
    paddingHorizontal: H_PAD,
    paddingTop:        SPACE.xl,
    paddingBottom:     SPACE.huge,
  },
  reviewHeader: { marginBottom: SPACE.xxl },
  reviewTitle: {
    fontSize:      26,
    fontWeight:    '700',
    color:         COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom:  SPACE.xs,
  },
  reviewSubtitle: { fontSize: 14, color: COLORS.textSecondary },

  detailsCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    marginBottom:    SPACE.xl,
    overflow:        'hidden',
    ...ELEVATION.card,
  },

  // Category chips — unified 1px border, smaller emoji
  chipRow: {
    flexDirection: 'row',
    gap:           SPACE.sm,
    paddingBottom: SPACE.sm,
    marginBottom:  SPACE.sm,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACE.md,
    paddingVertical:   7,
    borderRadius:      RADIUS.chip,
    borderWidth:       1,                // was 1.5
    backgroundColor:   'transparent',
    gap:               5,
  },
  chipEmoji:      { fontSize: 11 },      // was 14
  chipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // AI Notes
  notesCard: {
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.md,
    padding:         SPACE.md,
    gap:             SPACE.xs,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
    marginBottom:    SPACE.xl,
  },
  noteRow: { fontSize: 13, color: COLORS.warning, lineHeight: 19 },

  // Save / discard — saveGlow now wraps PressableScale
  saveGlow: {
    width:        '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.accent + '55',
  },
  saveBtnTxt:  { fontSize: 17, fontWeight: '700', color: COLORS.bg, letterSpacing: -0.2 },
  discardBtn: {
    height:         BTN_HEIGHT,
    justifyContent: 'center',
    alignItems:     'center',
    marginTop:      SPACE.xs,
  },
  discardTxt: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },

  // ── Sheet internals
  sheetBody: {
    fontSize:     15,
    color:        COLORS.textSecondary,
    lineHeight:   22,
    marginBottom: SPACE.xl,
    textAlign:    'center',
  },
  sheetGlow: {
    width:        '100%',
    borderRadius: RADIUS.button,
    marginBottom: SPACE.xs,
    ...ELEVATION.glow,
  },
  sheetPrimaryBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  sheetPrimaryTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  sheetGhostBtn: {
    height:         BTN_HEIGHT,
    justifyContent: 'center',
    alignItems:     'center',
  },
  sheetGhostTxt: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
});
