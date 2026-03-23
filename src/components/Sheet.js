import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Modal, StyleSheet, Text,
  TouchableWithoutFeedback, TouchableOpacity, View,
} from 'react-native';
import { COLORS, ELEVATION, H_PAD, RADIUS } from '../constants/theme';

const SCREEN_H = Dimensions.get('window').height;

// ─── Bottom Sheet ──────────────────────────────────────────────────────────────

export default function Sheet({ visible, onClose, title, children }) {
  const [show, setShow]  = useState(visible);
  const sheetY  = useRef(new Animated.Value(SCREEN_H)).current;
  const bgAlpha = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
    } else {
      Animated.parallel([
        Animated.timing(sheetY,  { toValue: SCREEN_H, duration: 260, useNativeDriver: true }),
        Animated.timing(bgAlpha, { toValue: 0,        duration: 220, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  useEffect(() => {
    if (!show) return;
    sheetY.setValue(SCREEN_H);
    bgAlpha.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY,  { toValue: 0, damping: 24, stiffness: 220, useNativeDriver: true }),
      Animated.timing(bgAlpha, { toValue: 1, duration: 220,              useNativeDriver: true }),
    ]).start();
  }, [show]);

  if (!show) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: bgAlpha }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[s.sheet, ELEVATION.sheet, { transform: [{ translateY: sheetY }] }]}>
          {/* Drag handle */}
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>

          {title ? (
            <View style={s.titleRow}>
              <Text style={s.title}>{title}</Text>
            </View>
          ) : null}

          <View style={s.content}>
            {children}
          </View>

          <View style={s.safeBottom} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Sheet row option ──────────────────────────────────────────────────────────

export function SheetOption({ icon, label, sublabel, onPress, destructive, last }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, damping: 20, stiffness: 400 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 20, stiffness: 300 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[s.option, last && s.optionLast]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {icon ? (
          <View style={[s.iconWrap, destructive && s.iconWrapDestructive]}>
            <Text style={s.optionIcon}>{icon}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[s.optionLabel, destructive && s.optionLabelDestructive]}>{label}</Text>
          {sublabel ? <Text style={s.optionSub}>{sublabel}</Text> : null}
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { backgroundColor: COLORS.overlay },

  sheet: {
    backgroundColor:   COLORS.card,
    borderTopLeftRadius:  RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderStrong,
    borderBottomWidth: 0,
  },

  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong },

  titleRow: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  content: { paddingHorizontal: H_PAD, paddingTop: 8 },

  option: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 15,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  optionLast: { borderBottomWidth: 0 },

  iconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapDestructive: { backgroundColor: COLORS.dangerMuted },

  optionIcon:             { fontSize: 17 },
  optionLabel:            { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  optionLabelDestructive: { color: COLORS.danger },
  optionSub:              { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  chevron:                { fontSize: 20, color: COLORS.textTertiary, marginRight: 4 },

  safeBottom: { height: 28 },
});
