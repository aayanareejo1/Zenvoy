import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, ELEVATION, H_PAD, RADIUS } from '../constants/theme';

// ─── Toast / snackbar ──────────────────────────────────────────────────────────
// showToast({ message, type, action, duration })
//   type:     'success' | 'error' | 'warning' | 'info'  (default 'info')
//   action:   { label: string, onPress: fn }             (optional)
//   duration: ms before auto-dismiss                      (default 3500)

const ToastCtx = createContext(null);

const TYPE_META = {
  success: { color: COLORS.success, bg: COLORS.successMuted },
  error:   { color: COLORS.danger,  bg: COLORS.dangerMuted  },
  warning: { color: COLORS.warning, bg: COLORS.warningMuted },
  info:    { color: COLORS.accent,  bg: COLORS.accentMuted  },
};

const ICON = {
  success: '✓',
  error:   '✕',
  warning: '!',
  info:    'i',
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
    Animated.spring(anim, { toValue: 1, damping: 20, stiffness: 240, useNativeDriver: true }).start();
    timer.current = setTimeout(dismiss, duration);
  }, [anim, dismiss]);

  const meta       = toast ? (TYPE_META[toast.type] ?? TYPE_META.info) : TYPE_META.info;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  return (
    <ToastCtx.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast && (
          <Animated.View style={[s.toast, ELEVATION.toast, { opacity: anim, transform: [{ translateY }] }]}>
            {/* Icon bubble */}
            <View style={[s.iconBubble, { backgroundColor: meta.bg }]}>
              <Text style={[s.iconText, { color: meta.color }]}>{ICON[toast.type]}</Text>
            </View>

            <Text style={s.msg} numberOfLines={3}>{toast.message}</Text>

            {toast.action && (
              <TouchableOpacity
                onPress={() => { dismiss(); toast.action.onPress(); }}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Text style={[s.actionTxt, { color: meta.color }]}>{toast.action.label}</Text>
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
    position:        'absolute',
    bottom:          90,
    left:            H_PAD,
    right:           H_PAD,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    flexDirection:   'row',
    alignItems:      'center',
    overflow:        'hidden',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.borderStrong,
    minHeight:       56,
    gap:             0,
  },
  iconBubble: {
    width: 44,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 15,
    fontWeight: '800',
  },
  msg: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    fontWeight: '500',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  actionTxt: {
    fontSize: 14,
    fontWeight: '700',
    paddingRight: 16,
    paddingVertical: 14,
  },
});
