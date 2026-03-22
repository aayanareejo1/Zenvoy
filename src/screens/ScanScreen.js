import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parseReceiptWithVision } from '../services/claude';
import { insertReceipt, getMonthlyCount, deriveStatus } from '../services/db';
import { syncReceiptToFirestore } from '../services/firestore';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD, CATEGORIES } from '../constants/theme';
import { FREE_MONTHLY_LIMIT } from '../constants/config';

export default function ScanScreen({ navigation }) {
  const { user, isPro } = useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [tax, setTax] = useState('');
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState([]);

  const handleScan = () => {
    Alert.alert('Scan Receipt', 'Choose source', [
      { text: 'Camera', onPress: () => pickImage('camera') },
      { text: 'Photo Library', onPress: () => pickImage('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickImage = async (source) => {
    const count = await getMonthlyCount();
    if (!isPro && count >= FREE_MONTHLY_LIMIT) {
      Alert.alert('Free Limit Reached', `You've scanned ${FREE_MONTHLY_LIMIT} receipts this month. Upgrade to Pro for unlimited scans.`, [
        { text: 'Upgrade', onPress: () => navigation.navigate('Account') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    const opts = { mediaTypes: ['images'], quality: 0.8 };
    let pickerResult;
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission denied'); return; }
        pickerResult = await ImagePicker.launchCameraAsync(opts);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission denied'); return; }
        pickerResult = await ImagePicker.launchImageLibraryAsync(opts);
      }
    } catch (e) { Alert.alert('Error', e.message); return; }

    if (!pickerResult || pickerResult.canceled) return;
    const uri = pickerResult.assets[0].uri;

    setLoading(true);
    setResult(null);
    try {
      const parsed = await parseReceiptWithVision(uri);
      setResult({ ...parsed, photo_uri: uri });
      setVendor(!parsed.vendor || parsed.vendor === 'Not found' ? '' : parsed.vendor);
      setDate(!parsed.date || parsed.date === 'Not found' ? '' : parsed.date);
      setTotal(!parsed.total || parsed.total === '0.00' ? '' : String(parsed.total));
      setTax(!parsed.tax || parsed.tax === '0.00' ? '' : String(parsed.tax));
      setCategory(parsed.category || 'Other');
      setNotes(parsed.notes || []);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const receipt = {
      vendor: vendor.trim() || null,
      date: date.trim() || null,
      total: parseFloat(total) || 0,
      tax: parseFloat(tax) || 0,
      category,
      notes,
      photo_uri: result?.photo_uri || null,
      created_at: new Date().toISOString(),
    };
    receipt.status = deriveStatus(receipt);
    const id = await insertReceipt(receipt);
    if (isPro && user) await syncReceiptToFirestore(user.uid, receipt);
    setResult(null);
    Alert.alert('Saved!', 'Receipt saved.', [{ text: 'OK', onPress: () => navigation.navigate('Receipts') }]);
  };

  const isNotFound = (v) => !v || v === 'Not found';

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Reading receipt...</Text>
      </View>
    );
  }

  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Review & Edit</Text>
        <Field label="Vendor" value={vendor} onChange={setVendor} warn={isNotFound(vendor)} />
        <Field label="Date" value={date} onChange={setDate} warn={isNotFound(date)} />
        <Field label="Total" value={total} onChange={setTotal} warn={isNotFound(total)} prefix="$" keyboardType="decimal-pad" />
        <Field label="Tax" value={tax} onChange={setTax} warn={false} prefix="$" keyboardType="decimal-pad" />

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
            {notes.map((n, i) => (
              <Text key={i} style={styles.noteText}>• {n}</Text>
            ))}
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
      <Text style={styles.logo}>ReceiptSnap</Text>
      <Text style={styles.tagline}>Scan. Save. Done.</Text>
      <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
        <Text style={styles.scanBtnText}>📷  Scan Receipt</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: H_PAD },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingVertical: 24 },
  logo: { fontSize: 36, fontWeight: '800', color: COLORS.accent, marginBottom: 8 },
  tagline: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 60 },
  scanBtn: { backgroundColor: COLORS.accent, height: BTN_HEIGHT, paddingHorizontal: 40, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center' },
  scanBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  inputWarn: { borderColor: COLORS.warning },
  prefix: { color: COLORS.textPrimary, fontSize: 16, marginRight: 4 },
  input: { flex: 1, height: 44, color: COLORS.textPrimary, fontSize: 16 },
  warnText: { fontSize: 12, color: COLORS.warning, marginTop: 4 },
  loadingText: { color: COLORS.textSecondary, marginTop: 16, fontSize: 16 },
  categoryLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryScroll: { marginBottom: 8 },
  categoryContent: { paddingBottom: 8, gap: 8, flexDirection: 'row' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.chip, borderWidth: 1.5, backgroundColor: 'transparent', gap: 6 },
  categoryEmoji: { fontSize: 16 },
  categoryChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  cancelBtn: { height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  cancelBtnText: { fontSize: 16, color: COLORS.textSecondary },
  notesBox: { backgroundColor: COLORS.cardAlt, borderRadius: RADIUS.input, padding: 12, marginBottom: 16, gap: 4 },
  noteText: { fontSize: 13, color: COLORS.warning, lineHeight: 18 },
});
