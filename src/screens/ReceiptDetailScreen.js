import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { updateReceipt, deleteReceipt, softDeleteReceipt, getReceiptById } from '../services/db';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useToast } from '../context/ToastContext';
import Dialog from '../components/Dialog';
import { COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE, getCategoryInfo } from '../constants/theme';

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
  const { receipt: initialReceipt, onSave } = route.params;
  const { showToast } = useToast();
  const [receipt, setReceipt] = useState(initialReceipt);
  const [photoUri, setPhotoUri] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const notes = receipt.notes || [];
  const cat = getCategoryInfo(receipt.category);

  const canMarkReady =
    (receipt.vendor || '').trim() &&
    (receipt.date || '').trim() &&
    parseFloat(receipt.total) > 0;

  // Reload fresh data from DB whenever this screen gains focus (e.g. after editing)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const fresh = await getReceiptById(receipt.id);
          if (cancelled) return;
          if (!fresh || fresh.status === 'deleted') {
            onSave?.();
            navigation.goBack();
            return;
          }
          setReceipt(fresh);
        } catch {
          // DB read failed — keep existing state; user can still navigate away
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [receipt.id, onSave, navigation])
  );

  const handleMarkReady = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!canMarkReady) {
      showToast({ message: 'Set vendor, date, and total before marking ready.', type: 'warning' });
      return;
    }
    await updateReceipt(receipt.id, { ...receipt, status: 'ready' });
    onSave?.();
    navigation.goBack();
  };

  const confirmDelete = async () => {
    setDeleteDialog(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await softDeleteReceipt(receipt.id);
    onSave?.();
    navigation.goBack();
  };

  const handleShare = async () => {
    try {
      const lines = [
        `Vendor: ${receipt.vendor || 'Not set'}`,
        `Date: ${receipt.date || 'Not set'}`,
        `Total: ${parseFloat(receipt.total) > 0 ? `$${parseFloat(receipt.total).toFixed(2)}` : 'Not set'}`,
        `Category: ${getCategoryInfo(receipt.category).label}`,
      ];
      const text = lines.join('\n');
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showToast({ message: 'Sharing is not available on this device.', type: 'warning' });
        return;
      }
      const tmpPath = `${FileSystem.cacheDirectory}receipt_${receipt.id}.txt`;
      await FileSystem.writeAsStringAsync(tmpPath, text, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(tmpPath, { mimeType: 'text/plain', dialogTitle: 'Share Receipt' });
    } catch (e) {
      showToast({ message: 'Could not share receipt.', type: 'error' });
    }
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
      {receipt.status === 'needs_review' && (
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewBannerIcon}>⚠</Text>
          <Text style={styles.reviewBannerText}>Needs review — some fields may be missing</Text>
        </View>
      )}

      {/* Category badge */}
      <View style={[styles.catBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '60' }]}>
        <Text style={styles.catEmoji}>{cat.emoji}</Text>
        <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
      </View>

      <Text style={styles.heading}>Receipt Detail</Text>

      {/* Text fields (view only) */}
      {[['Vendor', receipt.vendor], ['Date', receipt.date]].map(([l, v]) => (
        <View key={l} style={styles.field}>
          <Text style={styles.label}>{l}</Text>
          <Text style={[styles.value, !v && styles.valueMissing]}>{v || 'Not set'}</Text>
        </View>
      ))}

      {[['Total', receipt.total, true], ['Tax', receipt.tax, false]].map(([l, v, required]) => (
        <View key={l} style={styles.field}>
          <Text style={styles.label}>{l}</Text>
          <Text style={[styles.value, !parseFloat(v) && required && styles.valueMissing]}>
            {parseFloat(v) > 0 ? `$${parseFloat(v).toFixed(2)}` : required ? 'Not set' : '$0.00'}
          </Text>
        </View>
      ))}

      {/* AI Notes */}
      {notes.length > 0 && (
        <View style={styles.field}>
          <Text style={styles.label}>AI Notes</Text>
          <View style={styles.notesBox}>
            {notes.map((n, i) => (
              <Text key={i} style={styles.noteText}>
                · {n}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Photo viewer button */}
      {receipt.photo_uri && (
        <TouchableOpacity
          style={styles.photoBtn}
          onPress={() => setPhotoUri(receipt.photo_uri)}
          activeOpacity={0.75}
        >
          <Text style={styles.photoBtnText}>🖼  View Photo</Text>
        </TouchableOpacity>
      )}

      {/* Share */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.75}>
        <Text style={styles.editTxt}>Share Receipt</Text>
      </TouchableOpacity>

      {/* Actions */}
      {receipt.status === 'needs_review' && (
        <View style={[styles.glowWrap, !canMarkReady && { opacity: 0.45 }]}>
          <TouchableOpacity
            style={styles.markReadyBtn}
            onPress={handleMarkReady}
            activeOpacity={0.9}
            disabled={!canMarkReady}
          >
            <Text style={styles.markReadyTxt}>✓  Mark as Ready</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => navigation.navigate('EditReceipt', { receiptId: receipt.id })}
        activeOpacity={0.75}
      >
        <Text style={styles.editTxt}>Edit Receipt</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteDialog(true)} activeOpacity={0.75}>
        <Text style={styles.deleteTxt}>Delete Receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: H_PAD, paddingBottom: 48 },

  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningMuted,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '55',
    padding: SPACE.md,
    marginBottom: SPACE.lg,
    gap: SPACE.sm,
  },
  reviewBannerIcon: { fontSize: 15, color: COLORS.warning },
  reviewBannerText: { color: COLORS.warning, fontSize: 13, fontWeight: '600', flex: 1 },

  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACE.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    gap: 6,
    marginBottom: SPACE.lg,
  },
  catEmoji: { fontSize: 17 },
  catLabel: { fontSize: 14, fontWeight: '700' },

  heading: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.5, marginBottom: SPACE.xxl },

  field: { marginBottom: SPACE.xl },
  label: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACE.sm,
  },
  value: { fontSize: 20, color: COLORS.textPrimary, fontWeight: '500' },
  valueMissing: { color: COLORS.textTertiary, fontStyle: 'italic', fontSize: 16 },

  notesBox: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    gap: SPACE.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  noteText: { fontSize: 13, color: COLORS.warning, lineHeight: 19 },

  photoBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.sm,
    backgroundColor: COLORS.cardAlt,
  },
  photoBtnText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

  glowWrap: {
    width: '100%',
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  markReadyBtn: {
    backgroundColor: COLORS.accent,
    height: BTN_HEIGHT,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.sm,
  },
  markReadyTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  shareBtn: {
    backgroundColor: COLORS.card,
    height: BTN_HEIGHT,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtn: {
    backgroundColor: COLORS.card,
    height: BTN_HEIGHT,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editTxt: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },

  deleteBtn: {
    height: BTN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.xs,
  },
  deleteTxt: { color: COLORS.danger, fontSize: 15, fontWeight: '500' },
});

const viewer = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  closeTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  unavailable: { color: '#555', fontSize: 16 },
});