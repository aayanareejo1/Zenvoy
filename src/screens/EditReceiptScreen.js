import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useToast }  from '../context/ToastContext';
import Dialog        from '../components/Dialog';
import { getReceiptById, updateReceipt, softDeleteReceipt } from '../services/db';
import {
  COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE,
  CATEGORIES, getCategoryInfo,
} from '../constants/theme';

export default function EditReceiptScreen({ route, navigation }) {
  const { receiptId } = route.params;
  const { showToast } = useToast();

  const [loading, setLoading]       = useState(true);
  const [vendor, setVendor]         = useState('');
  const [date, setDate]             = useState('');
  const [total, setTotal]           = useState('');
  const [tax, setTax]               = useState('');
  const [category, setCategory]     = useState('Other');
  const [notesText, setNotesText]   = useState('');
  const [status, setStatus]         = useState('ready');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [errors, setErrors]         = useState({});

  // Load receipt on mount
  useEffect(() => {
    let cancelled = false;
    getReceiptById(receiptId).then(r => {
      if (cancelled || !r) return;
      setVendor(r.vendor   || '');
      setDate(r.date       || '');
      setTotal(r.total     > 0 ? String(r.total)   : '');
      setTax(r.tax         > 0 ? String(r.tax)     : '');
      setCategory(r.category || 'Other');
      setNotesText(Array.isArray(r.notes) ? r.notes.join('\n') : '');
      setStatus(r.status   || 'ready');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [receiptId]);

  const validate = useCallback(() => {
    const errs = {};
    if (!vendor.trim() || vendor.trim().length < 2) errs.vendor = 'Vendor must be at least 2 characters';
    if (!date.trim())                                errs.date   = 'Date is required';
    const t = parseFloat(total);
    if (!total.trim() || isNaN(t) || t <= 0)        errs.total  = 'Total must be a number greater than 0';
    const tx = parseFloat(tax);
    if (tax.trim() && (isNaN(tx) || tx < 0))        errs.tax    = 'Tax must be 0 or greater';
    if (!category)                                   errs.category = 'Category is required';
    return errs;
  }, [vendor, date, total, tax, category]);

  const handleSave = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast({ message: 'Please fix the highlighted fields', type: 'warning' });
      return;
    }
    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const notes = notesText.split('\n').map(l => l.trim()).filter(Boolean);
    await updateReceipt(receiptId, {
      vendor:   vendor.trim(),
      date:     date.trim(),
      total:    parseFloat(total),
      tax:      parseFloat(tax) || 0,
      category,
      status,
      notes,
    });
    showToast({ message: 'Receipt updated!', type: 'success' });
    navigation.goBack();
  }, [validate, notesText, receiptId, vendor, date, total, tax, category, status, showToast, navigation]);

  const confirmDelete = useCallback(async () => {
    setDeleteDialog(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await softDeleteReceipt(receiptId);
    showToast({ message: 'Receipt deleted', type: 'success' });
    navigation.goBack();
  }, [receiptId, showToast, navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const cat = getCategoryInfo(category);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Dialog
        visible={deleteDialog}
        title="Delete Receipt"
        message="This receipt will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog(false)}
      />

      {/* Category badge */}
      <View style={[styles.catBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '60' }]}>
        <Text style={styles.catEmoji}>{cat.emoji}</Text>
        <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
      </View>

      <Text style={styles.heading}>Edit Receipt</Text>

      {/* Vendor */}
      <View style={styles.field}>
        <Text style={styles.label}>Vendor <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.vendor && styles.inputError]}
          value={vendor}
          onChangeText={t => { setVendor(t); setErrors(e => ({ ...e, vendor: undefined })); }}
          placeholder="e.g. Starbucks"
          placeholderTextColor={COLORS.textTertiary}
          selectionColor={COLORS.accent}
          autoCapitalize="words"
        />
        {errors.vendor && <Text style={styles.errorText}>{errors.vendor}</Text>}
      </View>

      {/* Date */}
      <View style={styles.field}>
        <Text style={styles.label}>Date <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.date && styles.inputError]}
          value={date}
          onChangeText={t => { setDate(t); setErrors(e => ({ ...e, date: undefined })); }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.textTertiary}
          selectionColor={COLORS.accent}
        />
        {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
      </View>

      {/* Total */}
      <View style={styles.field}>
        <Text style={styles.label}>Total <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.total && styles.inputError]}
          value={total}
          onChangeText={t => { setTotal(t); setErrors(e => ({ ...e, total: undefined })); }}
          placeholder="0.00"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          selectionColor={COLORS.accent}
        />
        {errors.total && <Text style={styles.errorText}>{errors.total}</Text>}
      </View>

      {/* Tax */}
      <View style={styles.field}>
        <Text style={styles.label}>Tax</Text>
        <TextInput
          style={[styles.input, errors.tax && styles.inputError]}
          value={tax}
          onChangeText={t => { setTax(t); setErrors(e => ({ ...e, tax: undefined })); }}
          placeholder="0.00"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          selectionColor={COLORS.accent}
        />
        {errors.tax && <Text style={styles.errorText}>{errors.tax}</Text>}
      </View>

      {/* Category */}
      <View style={styles.field}>
        <Text style={[styles.label, errors.category && { color: COLORS.danger }]}>
          Category <Text style={styles.required}>*</Text>
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.catChip,
                { borderColor: c.color + '80' },
                category === c.key && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => { setCategory(c.key); setErrors(e => ({ ...e, category: undefined })); }}
              activeOpacity={0.75}
            >
              <Text style={styles.catChipEmoji}>{c.emoji}</Text>
              <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
      </View>

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notesText}
          onChangeText={setNotesText}
          placeholder="One note per line"
          placeholderTextColor={COLORS.textTertiary}
          multiline
          textAlignVertical="top"
          selectionColor={COLORS.accent}
        />
      </View>

      {/* Save */}
      <View style={[styles.glowWrap, { marginTop: SPACE.xl }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.9}>
          <Text style={styles.saveTxt}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteDialog(true)} activeOpacity={0.75}>
        <Text style={styles.deleteTxt}>Delete Receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex:            1,
    backgroundColor: COLORS.bg,
    justifyContent:  'center',
    alignItems:      'center',
  },

  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: H_PAD, paddingBottom: 48 },

  catBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    paddingHorizontal: SPACE.md,
    paddingVertical:   8,
    borderRadius:      RADIUS.pill,
    borderWidth:       1.5,
    gap:               6,
    marginBottom:      SPACE.lg,
  },
  catEmoji: { fontSize: 17 },
  catLabel: { fontSize: 14, fontWeight: '700' },

  heading: {
    fontSize:     26,
    fontWeight:   '700',
    color:        COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: SPACE.xxl,
  },

  field:    { marginBottom: SPACE.xl },
  label: {
    fontSize:      11,
    color:         COLORS.textSecondary,
    fontWeight:    '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom:  SPACE.sm,
  },
  required: { color: COLORS.danger },
  input: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.md,
    height:            48,
    color:             COLORS.textPrimary,
    fontSize:          16,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  notesInput: {
    height:         100,
    paddingTop:     SPACE.md,
    paddingBottom:  SPACE.md,
  },
  errorText: {
    fontSize:   12,
    color:      COLORS.danger,
    marginTop:  SPACE.xs,
    fontWeight: '500',
  },

  catChips:         { gap: SPACE.sm, flexDirection: 'row', paddingBottom: SPACE.xs },
  catChip: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: SPACE.md,
    paddingVertical:   8,
    borderRadius:      RADIUS.chip,
    borderWidth:       1.5,
    gap:               6,
  },
  catChipEmoji:      { fontSize: 14 },
  catChipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },

  glowWrap: {
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
  },
  saveTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  deleteBtn: {
    height:         BTN_HEIGHT,
    justifyContent: 'center',
    alignItems:     'center',
    marginTop:      SPACE.sm,
  },
  deleteTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
});
