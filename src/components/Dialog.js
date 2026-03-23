import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { COLORS, H_PAD, RADIUS } from '../constants/theme';

// ─── Confirmation dialog ───────────────────────────────────────────────────────
// Use for any action that is hard to undo (delete, sign out, destructive restore).
//
// Usage:
//   <Dialog
//     visible={deleteDialog}
//     title="Delete Receipt"
//     message="This can't be undone."
//     confirmLabel="Delete"
//     destructive
//     onConfirm={handleDeleteConfirmed}
//     onCancel={() => setDeleteDialog(false)}
//   />

export default function Dialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  destructive  = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Backdrop tap dismisses */}
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={s.overlay}>
          {/* Inner TWFB stops backdrop tap from passing through box */}
          <TouchableWithoutFeedback>
            <View style={s.box}>
              <Text style={s.title}>{title}</Text>
              {message ? <Text style={s.message}>{message}</Text> : null}
              <View style={s.row}>
                <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel} activeOpacity={0.7}>
                  <Text style={s.cancelTxt}>{cancelLabel}</Text>
                </TouchableOpacity>
                <View style={s.divider} />
                <TouchableOpacity style={[s.btn, s.confirmBtn]} onPress={onConfirm} activeOpacity={0.7}>
                  <Text style={[s.confirmTxt, destructive && { color: COLORS.danger }]}>
                    {confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: H_PAD },
  box:        { backgroundColor: COLORS.card, borderRadius: RADIUS.card, width: '100%', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  title:      { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', paddingTop: 24, paddingHorizontal: 20 },
  message:    { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, paddingTop: 8, paddingHorizontal: 20, paddingBottom: 4 },
  row:        { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, marginTop: 20 },
  btn:        { flex: 1, paddingVertical: 16, alignItems: 'center' },
  cancelBtn:  {},
  confirmBtn: {},
  divider:    { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  cancelTxt:  { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500' },
  confirmTxt: { fontSize: 16, color: COLORS.accent, fontWeight: '600' },
});
