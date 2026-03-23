import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, H_PAD, RADIUS } from '../constants/theme';

// ─── Toast / snackbar ──────────────────────────────────────────────────────────
// Wrap the app root with <ToastProvider>.
// Call showToast() from any child component via the useToast() hook.
//
// showToast({ message, type, action, duration })
//   type:     'success' | 'error' | 'warning' | 'info'  (default 'info')
//   action:   { label: string, onPress: fn }             (optional)
//   duration: ms before auto-dismiss                      (default 3500)

const ToastCtx = createContext(null);

const TYPE_COLOR = {
  success: COLORS.accent,
  error:   COLORS.danger,
  warning: COLORS.warning,
  info:    COLORS.textSecondary,
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const anim  = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setToast(null));
  }, [anim]);

  const showToast = useCallback(({ message, type = 'info', action, duration = 3500 }) => {
    if (timer.current) clearTimeout(timer.current);
    anim.stopAnimation();
    anim.setValue(0);
    setToast({ message, type, action });
    Animated.spring(anim, { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }).start();
    timer.current = setTimeout(dismiss, duration);
  }, [anim, dismiss]);

  const color      = toast ? (TYPE_COLOR[toast.type] ?? COLORS.textSecondary) : COLORS.textSecondary;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  return (
    <ToastCtx.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast && (
          <Animated.View style={[s.toast, { opacity: anim, transform: [{ translateY }] }]}>
            <View style={[s.indicator, { backgroundColor: color }]} />
            <Text style={s.msg} numberOfLines={3}>{toast.message}</Text>
            {toast.action && (
              <TouchableOpacity
                onPress={() => { dismiss(); toast.action.onPress(); }}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              >
                <Text style={[s.actionTxt, { color }]}>{toast.action.label}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const s = StyleSheet.create({
  toast: {
    position:      'absolute',
    bottom:        90,
    left:          H_PAD,
    right:         H_PAD,
    backgroundColor: COLORS.card,
    borderRadius:  RADIUS.card,
    flexDirection: 'row',
    alignItems:    'center',
    overflow:      'hidden',
    elevation:     10,
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
    borderWidth:   StyleSheet.hairlineWidth,
    borderColor:   COLORS.border,
    minHeight:     52,
  },
  indicator: { width: 4, alignSelf: 'stretch' },
  msg:       { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20, paddingVertical: 14, paddingHorizontal: 12 },
  actionTxt: { fontSize: 14, fontWeight: '700', paddingRight: 14, paddingVertical: 14 },
});
