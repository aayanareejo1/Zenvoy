import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Modal, StyleSheet, Text,
  TouchableWithoutFeedback, TouchableOpacity, View,
} from 'react-native';
import { COLORS, H_PAD } from '../constants/theme';

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
        Animated.timing(sheetY,  { toValue: SCREEN_H, duration: 240, useNativeDriver: true }),
        Animated.timing(bgAlpha, { toValue: 0,        duration: 220, useNativeDriver: true }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  useEffect(() => {
    if (!show) return;
    sheetY.setValue(SCREEN_H);
    bgAlpha.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY,  { toValue: 0, damping: 22, stiffness: 200, useNativeDriver: true }),
      Animated.timing(bgAlpha, { toValue: 1, duration: 200,              useNativeDriver: true }),
    ]).start();
  }, [show]);

  if (!show) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: bgAlpha }]} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={s.handle} />
          {title ? <Text style={s.title}>{title}</Text> : null}
          {children}
          <View style={s.safeBottom} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Sheet row option ──────────────────────────────────────────────────────────

export function SheetOption({ icon, label, sublabel, onPress, destructive, last }) {
  return (
    <TouchableOpacity
      style={[s.option, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {icon ? <Text style={s.optionIcon}>{icon}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.optionLabel, destructive && { color: COLORS.danger }]}>{label}</Text>
        {sublabel ? <Text style={s.optionSub}>{sublabel}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: H_PAD, paddingTop: 12 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  title:       { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 4 },
  option:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  optionIcon:  { fontSize: 20, width: 28, textAlign: 'center' },
  optionLabel: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  optionSub:   { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  safeBottom:  { height: 24 },
});
