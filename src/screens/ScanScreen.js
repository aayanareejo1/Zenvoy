import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parseReceiptWithVision }    from '../services/claude';
import { preprocessImage, isTooLarge } from '../services/imageProcessor';
import { insertReceipt, getMonthlyCount, deriveStatus } from '../services/db';
import { syncReceiptToFirestore }    from '../services/firestore';
import { useApp }                    from '../context/AppContext';
import { useToast }                  from '../context/ToastContext';
import Sheet, { SheetOption }        from '../components/Sheet';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD, CATEGORIES } from '../constants/theme';
import { FREE_MONTHLY_LIMIT }        from '../constants/config';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const checkScanLimit = async (isPro) => {
  if (isPro) return true;
  const count = await getMonthlyCount();
  return count < FREE_MONTHLY_LIMIT;
};

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

  // Sheet visibility states
  const [sourceSheet,   setSourceSheet]   = useState(false); // single-scan source
  const [multiSheet,    setMultiSheet]    = useState(false); // multi-scan source
  const [tooLargeSheet, setTooLargeSheet] = useState(false); // image too large
  const [paywallSheet,  setPaywallSheet]  = useState(false); // monthly limit
  const [againSheet,    setAgainSheet]    = useState(false); // "capture another?"

  // Resolve ref for the Promise-based "capture another?" flow
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

  // Promise-based "capture another?" — resolves when user picks Yes or No
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

  // ── Save (single scan) ─────────────────────────────────────────────────────

  const handleSave = async () => {
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
      showToast({
        message: 'Saved to Inbox — some fields were missing.',
        type: 'warning',
        action: { label: 'View', onPress: () => navigation.navigate('Inbox') },
      });
    } else {
      showToast({
        message: 'Receipt saved!',
        type: 'success',
        action: { label: 'View', onPress: () => navigation.navigate('Receipts') },
      });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Reading receipt…</Text>
      </View>
    );
  }

  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Review & Edit</Text>
        <Field label="Vendor" value={vendor} onChange={setVendor} warn={!vendor} />
        <Field label="Date"   value={date}   onChange={setDate}   warn={!date} />
        <Field label="Total"  value={total}  onChange={setTotal}  warn={!total} prefix="$" keyboardType="decimal-pad" />
        <Field label="Tax"    value={tax}    onChange={setTax}    warn={false}  prefix="$" keyboardType="decimal-pad" />

        <Text style={styles.categoryLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, { borderColor: cat.color }, category === cat.key && { backgroundColor: cat.color }]}
              onPress={() => setCategory(cat.key)}
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
            {notes.map((n, i) => <Text key={i} style={styles.noteText}>• {n}</Text>)}
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setResult(null)}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.center]}>

      {/* ── Source chooser — single scan ──────────────────────────────────── */}
      <Sheet visible={sourceSheet} onClose={() => setSourceSheet(false)} title="Scan Receipt">
        <SheetOption icon="📷" label="Camera"        onPress={() => pickSingle('camera')}  />
        <SheetOption icon="🖼️" label="Photo Library" onPress={() => pickSingle('gallery')} last />
      </Sheet>

      {/* ── Source chooser — multi scan ───────────────────────────────────── */}
      <Sheet visible={multiSheet} onClose={() => setMultiSheet(false)} title="Multi Scan">
        <SheetOption icon="📷" label="Camera"        sublabel="Capture one at a time" onPress={() => { setMultiSheet(false); doMultiScan('camera');  }} />
        <SheetOption icon="🖼️" label="Photo Library" sublabel="Select multiple at once" onPress={() => { setMultiSheet(false); doMultiScan('gallery'); }} last />
      </Sheet>

      {/* ── Image too large ───────────────────────────────────────────────── */}
      <Sheet visible={tooLargeSheet} onClose={() => setTooLargeSheet(false)} title="Image Too Large">
        <Text style={sheet.body}>
          The photo couldn't be compressed enough to process. Try cropping tighter or retaking closer to the receipt.
        </Text>
        <SheetOption icon="📷" label="Retake / Recrop" onPress={() => { setTooLargeSheet(false); setSourceSheet(true); }} />
        <SheetOption icon="✏️" label="Enter Manually"  onPress={() => { setTooLargeSheet(false); setResult({ photo_uri: null }); }} last />
      </Sheet>

      {/* ── Paywall ───────────────────────────────────────────────────────── */}
      <Sheet visible={paywallSheet} onClose={() => setPaywallSheet(false)} title="Monthly Limit Reached">
        <Text style={sheet.body}>
          Free accounts can scan {FREE_MONTHLY_LIMIT} receipts per month. Upgrade to Pro for unlimited scans and cloud backup.
        </Text>
        <TouchableOpacity style={sheet.upgradeBtn} onPress={() => { setPaywallSheet(false); navigation.navigate('Account'); }}>
          <Text style={sheet.upgradeTxt}>Upgrade to Pro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={sheet.cancelOption} onPress={() => setPaywallSheet(false)}>
          <Text style={sheet.cancelTxt}>Maybe later</Text>
        </TouchableOpacity>
      </Sheet>

      {/* ── Capture another? (multi-scan camera loop) ─────────────────────── */}
      <Sheet visible={againSheet} onClose={() => resolveAgain(false)} title="Receipt added">
        <SheetOption icon="➕" label="Capture another" onPress={() => resolveAgain(true)}  />
        <SheetOption icon="✅" label="Done"            onPress={() => resolveAgain(false)} last />
      </Sheet>

      <Text style={styles.logo}>Zenvoy</Text>
      <Text style={styles.tagline}>Scan. Save. Done.</Text>
      <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
        <Text style={styles.scanBtnText}>📷  Scan Receipt</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.multiBtn} onPress={handleMultiScan}>
        <Text style={styles.multiBtnText}>⚡  Multi Scan</Text>
      </TouchableOpacity>
    </View>
  );
}

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
          placeholderTextColor={COLORS.textSecondary}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      </View>
      {warn && <Text style={styles.warnText}>Not detected — please enter manually</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  center:                 { justifyContent: 'center', alignItems: 'center' },
  scrollContent:          { paddingVertical: 24 },
  logo:                   { fontSize: 36, fontWeight: '800', color: COLORS.accent, marginBottom: 8 },
  tagline:                { fontSize: 16, color: COLORS.textSecondary, marginBottom: 48 },
  scanBtn:                { backgroundColor: COLORS.accent, height: BTN_HEIGHT, paddingHorizontal: 40, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 12 },
  scanBtnText:            { fontSize: 18, fontWeight: '700', color: COLORS.bg },
  multiBtn:               { height: BTN_HEIGHT, paddingHorizontal: 40, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', width: '100%', borderWidth: 1.5, borderColor: COLORS.border },
  multiBtnText:           { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  heading:                { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  field:                  { marginBottom: 16 },
  fieldLabel:             { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow:               { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  inputWarn:              { borderColor: COLORS.warning },
  prefix:                 { color: COLORS.textPrimary, fontSize: 16, marginRight: 4 },
  input:                  { flex: 1, height: 44, color: COLORS.textPrimary, fontSize: 16 },
  warnText:               { fontSize: 12, color: COLORS.warning, marginTop: 4 },
  loadingText:            { color: COLORS.textSecondary, marginTop: 16, fontSize: 16 },
  categoryLabel:          { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryScroll:         { marginBottom: 8 },
  categoryContent:        { paddingBottom: 8, gap: 8, flexDirection: 'row' },
  categoryChip:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.chip, borderWidth: 1.5, backgroundColor: 'transparent', gap: 6 },
  categoryEmoji:          { fontSize: 16 },
  categoryChipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  saveBtn:                { backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText:            { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  cancelBtn:              { height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  cancelBtnText:          { fontSize: 16, color: COLORS.textSecondary },
  notesBox:               { backgroundColor: COLORS.cardAlt, borderRadius: RADIUS.input, padding: 12, marginBottom: 16, gap: 4 },
  noteText:               { fontSize: 13, color: COLORS.warning, lineHeight: 18 },
});

// Styles used inside Sheet content (paywall / tooLarge body text)
const sheet = StyleSheet.create({
  body:          { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20, textAlign: 'center', paddingHorizontal: 4 },
  upgradeBtn:    { backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  upgradeTxt:    { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  cancelOption:  { height: BTN_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  cancelTxt:     { fontSize: 15, color: COLORS.textSecondary },
});
