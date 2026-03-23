import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Image } from 'react-native';
import { updateReceipt, deleteReceipt } from '../services/db';
import { useToast }  from '../context/ToastContext';
import Dialog        from '../components/Dialog';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, CATEGORIES, getCategoryInfo } from '../constants/theme';

// ─── Full-screen photo viewer ──────────────────────────────────────────────────

function PhotoViewer({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={viewer.overlay}>
        <TouchableOpacity style={viewer.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={viewer.closeTxt}>✕</Text>
        </TouchableOpacity>
        {uri ? (
          <Image source={{ uri }} style={viewer.image} resizeMode="contain" />
        ) : (
          <Text style={viewer.unavailable}>Photo not available</Text>
        )}
      </View>
    </Modal>
  );
}

// ─── Detail screen ─────────────────────────────────────────────────────────────

export default function ReceiptDetailScreen({ route, navigation }) {
  const { receipt, onSave } = route.params;
  const { showToast }       = useToast();
  const [editing, setEditing]     = useState(false);
  const [vendor, setVendor]       = useState(receipt.vendor || '');
  const [date, setDate]           = useState(receipt.date || '');
  const [total, setTotal]         = useState(String(receipt.total ?? ''));
  const [tax, setTax]             = useState(String(receipt.tax ?? ''));
  const [category, setCategory]   = useState(receipt.category || 'Other');
  const [status, setStatus]       = useState(receipt.status || 'ready');
  const [photoUri, setPhotoUri]   = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const notes = receipt.notes || [];
  const cat   = getCategoryInfo(category);

  const canMarkReady = vendor.trim() && date.trim() && parseFloat(total) > 0;

  const handleSave = async () => {
    const updated = {
      vendor:   vendor.trim() || null,
      date:     date.trim()   || null,
      total:    parseFloat(total) || 0,
      tax:      parseFloat(tax)   || 0,
      category,
      status,
      notes,
    };
    await updateReceipt(receipt.id, updated);
    setEditing(false);
    onSave?.();
    showToast({ message: 'Changes saved', type: 'success' });
  };

  const handleMarkReady = async () => {
    if (!canMarkReady) {
      showToast({ message: 'Set vendor, date, and total before marking ready.', type: 'warning' });
      return;
    }
    await updateReceipt(receipt.id, {
      vendor:   vendor.trim() || null,
      date:     date.trim()   || null,
      total:    parseFloat(total) || 0,
      tax:      parseFloat(tax)   || 0,
      category,
      status:   'ready',
      notes,
    });
    setStatus('ready');
    onSave?.();
    navigation.goBack();
  };

  const confirmDelete = async () => {
    setDeleteDialog(false);
    await deleteReceipt(receipt.id);
    onSave?.();
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhotoViewer uri={photoUri} onClose={() => setPhotoUri(null)} />
      <Dialog
        visible={deleteDialog}
        title="Delete Receipt"
        message="This receipt will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog(false)}
      />

      {/* Needs-review banner */}
      {status === 'needs_review' && (
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewBannerIcon}>⚠</Text>
          <Text style={styles.reviewBannerText}>Needs review — some fields may be missing</Text>
        </View>
      )}

      {/* Category badge (view mode only) */}
      {!editing && (
        <View style={[styles.catBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '60' }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
          <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
      )}

      <Text style={styles.heading}>Receipt Detail</Text>

      {/* Text fields */}
      {[['Vendor', vendor, setVendor, 'default'], ['Date', date, setDate, 'default']].map(([l, v, s, kt]) => (
        <View key={l} style={styles.field}>
          <Text style={styles.label}>{l}</Text>
          {editing
            ? <TextInput
                style={styles.input}
                value={v}
                onChangeText={s}
                keyboardType={kt}
                placeholderTextColor={COLORS.textTertiary}
                placeholder={`Enter ${l.toLowerCase()}`}
                selectionColor={COLORS.accent}
              />
            : <Text style={[styles.value, !v && styles.valueMissing]}>{v || 'Not set'}</Text>}
        </View>
      ))}

      {[['Total', total, setTotal], ['Tax', tax, setTax]].map(([l, v, s]) => (
        <View key={l} style={styles.field}>
          <Text style={styles.label}>{l}</Text>
          {editing
            ? <TextInput
                style={styles.input}
                value={v}
                onChangeText={s}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textTertiary}
                selectionColor={COLORS.accent}
              />
            : <Text style={[styles.value, !parseFloat(v) && l === 'Total' && styles.valueMissing]}>
                {parseFloat(v) > 0 ? `$${parseFloat(v).toFixed(2)}` : l === 'Total' ? 'Not set' : '$0.00'}
              </Text>}
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
                style={[styles.catChip, { borderColor: c.color + '80' }, category === c.key && { backgroundColor: c.color, borderColor: c.color }]}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.75}
              >
                <Text style={styles.catChipEmoji}>{c.emoji}</Text>
                <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* AI Notes */}
      {notes.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>AI Notes</Text>
          <View style={styles.notesBox}>
            {notes.map((n, i) => <Text key={i} style={styles.noteText}>· {n}</Text>)}
          </View>
        </View>
      )}

      {/* Photo viewer button */}
      {receipt.photo_uri && (
        <TouchableOpacity style={styles.photoBtn} onPress={() => setPhotoUri(receipt.photo_uri)} activeOpacity={0.75}>
          <Text style={styles.photoBtnText}>🖼  View Photo</Text>
        </TouchableOpacity>
      )}

      {/* Actions */}
      {editing ? (
        <>
          <View style={styles.glowWrap}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.9}>
              <Text style={styles.saveTxt}>Save Changes</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setCategory(receipt.category || 'Other'); }} activeOpacity={0.7}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {status === 'needs_review' && (
            <View style={[styles.glowWrap, !canMarkReady && { opacity: 0.45 }]}>
              <TouchableOpacity
                style={styles.markReadyBtn}
                onPress={handleMarkReady}
                activeOpacity={0.9}
              >
                <Text style={styles.markReadyTxt}>✓  Mark as Ready</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)} activeOpacity={0.75}>
            <Text style={styles.editTxt}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteDialog(true)} activeOpacity={0.75}>
            <Text style={styles.deleteTxt}>Delete Receipt</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: H_PAD, paddingBottom: 48 },

  reviewBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.warningMuted,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.warning + '55',
    padding:         SPACE.md,
    marginBottom:    SPACE.lg,
    gap:             SPACE.sm,
  },
  reviewBannerIcon: { fontSize: 15, color: COLORS.warning },
  reviewBannerText: { color: COLORS.warning, fontSize: 13, fontWeight: '600', flex: 1 },

  catBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    paddingHorizontal: SPACE.md,
    paddingVertical:   8,
    borderRadius:  RADIUS.pill,
    borderWidth:   1.5,
    gap:           6,
    marginBottom:  SPACE.lg,
  },
  catEmoji: { fontSize: 17 },
  catLabel: { fontSize: 14, fontWeight: '700' },

  heading: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.5, marginBottom: SPACE.xxl },

  field:  { marginBottom: SPACE.xl },
  label: {
    fontSize: 11,
    color:    COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACE.sm,
  },
  value:        { fontSize: 20, color: COLORS.textPrimary, fontWeight: '500' },
  valueMissing: { color: COLORS.textTertiary, fontStyle: 'italic', fontSize: 16 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.input,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACE.md,
    height:          48,
    color:           COLORS.textPrimary,
    fontSize:        16,
  },

  catChips:         { gap: SPACE.sm, flexDirection: 'row', paddingBottom: SPACE.xs },
  catChip: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: SPACE.md,
    paddingVertical:   8,
    borderRadius:  RADIUS.chip,
    borderWidth:   1.5,
    gap:           6,
  },
  catChipEmoji:         { fontSize: 14 },
  catChipText:          { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive:    { color: '#fff' },

  notesBox: {
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.md,
    padding:         SPACE.md,
    gap:             SPACE.xs,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  noteText: { fontSize: 13, color: COLORS.warning, lineHeight: 19 },

  photoBtn: {
    borderWidth:   1,
    borderColor:   COLORS.border,
    borderRadius:  RADIUS.button,
    height:        46,
    justifyContent: 'center',
    alignItems:    'center',
    marginBottom:  SPACE.sm,
    backgroundColor: COLORS.cardAlt,
  },
  photoBtnText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

  glowWrap: {
    width:        '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  markReadyBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.sm,
  },
  markReadyTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  saveBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.xxl,
  },
  saveTxt: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  cancelBtn: {
    height:          BTN_HEIGHT,
    justifyContent:  'center',
    alignItems:      'center',
  },
  cancelTxt: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },

  editBtn: {
    backgroundColor: COLORS.card,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  editTxt: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },

  deleteBtn: {
    height:          BTN_HEIGHT,
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       SPACE.xs,
  },
  deleteTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
});

const viewer = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  image:       { width: '100%', height: '100%' },
  closeBtn: {
    position:        'absolute',
    top:             48,
    right:           20,
    zIndex:          10,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     'rgba(255,255,255,0.2)',
  },
  closeTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  unavailable: { color: '#555', fontSize: 16 },
});
