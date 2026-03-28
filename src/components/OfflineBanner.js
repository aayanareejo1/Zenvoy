import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSync } from '../context/SyncContext';
import { COLORS } from '../constants/theme';

export default function OfflineBanner() {
  const { isOnline } = useSync();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue:         isOnline ? 0 : 1,
      duration:        220,
      useNativeDriver: true,
    }).start();
  }, [isOnline, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-32, 0],
  });

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Text style={styles.text}>⚡ No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    zIndex:          9999,
    backgroundColor: COLORS.warning,
    paddingVertical: 6,
    alignItems:      'center',
  },
  text: {
    color:      '#111827',
    fontSize:   12,
    fontWeight: '700',
  },
});
