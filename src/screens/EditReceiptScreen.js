import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getDb } from '../services/db';
import { useToast } from '../context/ToastContext';
import Dialog from '../components/Dialog';
import {
  COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, CATEGORIES,
} from '../constants/theme';

export default function EditReceiptScreen({ route, navigation }) {
  const { receiptId, onSave } = route.params;
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const [vendor, setVendor]     = useState('');
  const [date, setDate]         = useState('');
  const [total, setTotal]       = useState('');
  const [tax, setTax]           = useState('');
  const [category, setCategory] = useState('Other');
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db  = await getDb();
        const row = await db.getFirstAsync(
          'SELECT * FROM receipts WHERE id=?',
          [receiptId]
        );
        if (row && !cancelled) {
          let notes = [];
          try { notes = JSON.parse(row.notes || '[]'); } catch { notes = []; }
          setVendor(row.vendor || '');
          setDate(row.date || '');
          setTotal(String(row.total ?? ''));
          setTax(String(row.tax ?? ''));
          setCategory(row.category || 'Other');
          setNotesText(notes.join('\n'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [receiptId]);

  const handleSave = async () => {
    if (!vendor.trim() || vendor.trim().length < 2) {
      showToast({ message: 'Vendor name must be at least 2 characters', type: 'warning' });
      return;
    }
    if (!date.trim()) {
      showToast({ message: 'Date is required', type: 'warning' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      showToast({ message: 'Date must be in YYYY-MM-DD format', type: 'warning' });
      return;
    }
    if (!total || parseFloat(total) <= 0) {
      showToast({ message: 'Total must be greater than 0', type: 'warning' });
      return;
    }
    if (tax && parseFloat(tax) < 0) {
      showToast({ message: 'Tax cannot be negative', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const notes = notesText.split('\n').filter(n => n.trim());
      const db = await getDb();
      await db.runAsync(
        `UPDATE receipts
         SET vendor=?, date=?, total=?, tax=?, category=?, notes=?, updated_at=?, synced=0
         WHERE id=?`,
        [
          vendor.trim(),
          date.trim(),
          parseFloat(total) || 0,
          parseFloat(tax)   || 0,
          category,
          JSON.stringify(notes),
          new Date().toISOString(),
          receiptId,
        ]
      );
      showToast({ message: 'Receipt updated', type: 'success' });
      onSave?.();
      navigation.goBack();
    } catch {
      showToast({ message: 'Failed to update receipt', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteDialog(false);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const db = await getDb();
      await db.runAsync(
        `UPDATE receipts SET status='deleted', synced=0, updated_at=? WHERE id=?`,
        [new Date().toISOString(), receiptId]
      );
      showToast({ message: 'Receipt deleted', type: 'success' });
      onSave?.();
      navigation.goBack();
    } catch {
      showToast({ message: 'Failed to delete receipt', type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Dialog
        visible={deleteDialog}
        title="Delete Receipt"
        message="This receipt will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog(false)}
      />

      {/* Vendor */}
      <View style={styles.field}>
        <Text style={styles.label}>Vendor *</Text>
        <TextInput
          style={styles.input}
          placeholder="Vendor name"
          placeholderTextColor={COLORS.textTertiary}
          value={vendor}
          onChangeText={setVendor}
          selectionColor={COLORS.accent}
        />
      </View>

      {/* Date */}
      <View style={styles.field}>
        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.textTertiary}
          value={date}
          onChangeText={setDate}
          selectionColor={COLORS.accent}
        />
      </View>

      {/* Total */}
      <View style={styles.field}>
        <Text style={styles.label}>Total *</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          value={total}
          onChangeText={setTotal}
          selectionColor={COLORS.accent}
        />
      </View>

      {/* Tax */}
      <View style={styles.field}>
        <Text style={styles.label}>Tax</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          value={tax}
          onChangeText={setTax}
          selectionColor={COLORS.accent}
        />
      </View>

      {/* Category */}
      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catChips}
        >
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.catChip,
                { borderColor: c.color + '80' },
                category === c.key && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => setCategory(c.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.catChipEmoji}>{c.emoji}</Text>
              <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Add notes… (one per line)"
          placeholderTextColor={COLORS.textTertiary}
          multiline
          numberOfLines={4}
          value={notesText}
          onChangeText={setNotesText}
          selectionColor={COLORS.accent}
        />
      </View>

      {/* Save */}
      <View style={[styles.glowWrap, isSaving && { opacity: 0.6 }]}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          <Text style={styles.saveTxt}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>

      {/* Delete */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => setDeleteDialog(true)}
        activeOpacity={0.75}
      >
        <Text style={styles.deleteTxt}>Delete Receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading:   { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: H_PAD, paddingBottom: 48 },

  field:  { marginBottom: SPACE.xl },
  label: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACE.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACE.md,
    height: 48,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    paddingTop: SPACE.md,
    textAlignVertical: 'top',
  },

  catChips: { gap: SPACE.sm, flexDirection: 'row', paddingBottom: SPACE.xs },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.md,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1.5,
    gap: 6,
  },
  catChipEmoji:      { fontSize: 14 },
  catChipText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },

  glowWrap: {
    width: '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
    marginTop: SPACE.lg,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    height: BTN_HEIGHT,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  deleteBtn: {
    height: BTN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.xs,
  },
  deleteTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
});
