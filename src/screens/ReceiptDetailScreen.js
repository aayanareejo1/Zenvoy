import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { updateReceipt, deleteReceipt } from '../services/db';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD, CATEGORIES, getCategoryInfo } from '../constants/theme';

export default function ReceiptDetailScreen({ route, navigation }) {
  const { receipt } = route.params;
  const [editing, setEditing] = useState(false);
  const [vendor, setVendor] = useState(String(receipt.vendor));
  const [date, setDate] = useState(String(receipt.date));
  const [total, setTotal] = useState(String(receipt.total));
  const [tax, setTax] = useState(String(receipt.tax));
  const [category, setCategory] = useState(receipt.category || 'Other');

  const cat = getCategoryInfo(category);

  const handleSave = async () => {
    await updateReceipt(receipt.id, { vendor, date, total: parseFloat(total) || 0, tax: parseFloat(tax) || 0, category });
    setEditing(false);
    Alert.alert('Saved');
  };

  const handleDelete = () => {
    Alert.alert('Delete Receipt', 'Are you sure?', [
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteReceipt(receipt.id); navigation.goBack(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Category badge (view mode) */}
      {!editing && (
        <View style={[styles.catBadge, { backgroundColor: cat.color + '22', borderColor: cat.color }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
          <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
      )}

      <Text style={styles.heading}>Receipt Detail</Text>

      {[['Vendor', vendor, setVendor, 'default'], ['Date', date, setDate, 'default']].map(([l, v, s, kt]) => (
        <View key={l} style={styles.field}>
          <Text style={styles.label}>{l}</Text>
          {editing
            ? <TextInput style={styles.input} value={v} onChangeText={s} keyboardType={kt} placeholderTextColor={COLORS.textSecondary} />
            : <Text style={styles.value}>{v}</Text>}
        </View>
      ))}

      {[['Total', total, setTotal], ['Tax', tax, setTax]].map(([l, v, s]) => (
        <View key={l} style={styles.field}>
          <Text style={styles.label}>{l}</Text>
          {editing
            ? <TextInput style={styles.input} value={v} onChangeText={s} keyboardType="decimal-pad" placeholderTextColor={COLORS.textSecondary} />
            : <Text style={styles.value}>${parseFloat(v).toFixed(2)}</Text>}
        </View>
      ))}

      {/* Category picker (edit mode) */}
      {editing && (
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, { borderColor: c.color }, category === c.key && { backgroundColor: c.color }]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={styles.catChipEmoji}>{c.emoji}</Text>
                <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {editing ? (
        <>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveTxt}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setCategory(receipt.category || 'Other'); }}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editTxt}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteTxt}>Delete Receipt</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: H_PAD, paddingBottom: 40 },
  catBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, gap: 6, marginBottom: 16 },
  catEmoji: { fontSize: 18 },
  catLabel: { fontSize: 14, fontWeight: '700' },
  heading: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  value: { fontSize: 18, color: COLORS.textPrimary, fontWeight: '500' },
  input: { backgroundColor: COLORS.card, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, height: 44, color: COLORS.textPrimary, fontSize: 16 },
  catChips: { gap: 8, flexDirection: 'row', paddingBottom: 4 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, gap: 6 },
  catChipEmoji: { fontSize: 15 },
  catChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: COLORS.accent, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  saveTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
  cancelBtn: { height: BTN_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { color: COLORS.textSecondary, fontSize: 16 },
  editBtn: { backgroundColor: COLORS.card, height: BTN_HEIGHT, borderRadius: RADIUS.button, justifyContent: 'center', alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  editTxt: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  deleteBtn: { height: BTN_HEIGHT, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  deleteTxt: { color: COLORS.danger, fontSize: 16 },
});
