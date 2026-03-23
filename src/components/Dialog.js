import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { COLORS, ELEVATION, H_PAD, RADIUS } from '../constants/theme';

// ─── Confirmation dialog ───────────────────────────────────────────────────────

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
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={[s.box, ELEVATION.modal]}>
              {/* Header */}
              <View style={s.header}>
                <Text style={s.title}>{title}</Text>
                {message ? <Text style={s.message}>{message}</Text> : null}
              </View>

              {/* Actions */}
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.btn, s.cancelBtn]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={s.cancelTxt}>{cancelLabel}</Text>
                </TouchableOpacity>

                <View style={s.divider} />

                <TouchableOpacity
                  style={[s.btn, s.confirmBtn]}
                  onPress={onConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={[s.confirmTxt, destructive && s.confirmTxtDestructive]}>
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
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: H_PAD + 8,
  },
  box: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
  },

  header: {
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  btn: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn:  {},
  confirmBtn: {},
  divider:    { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },

  cancelTxt: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  confirmTxt: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '600',
  },
  confirmTxtDestructive: {
    color: COLORS.danger,
  },
});
