import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACE, RADIUS, BTN_HEIGHT } from '../constants/theme';

export const ONBOARDING_KEY = 'onboarding_complete';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '👋',
    title: 'Welcome to Zenvoy',
    body:  'Track and organize receipts effortlessly, all in one place.',
  },
  {
    icon: '📷',
    title: 'Snap Receipts',
    body:  'Use your camera to capture receipts instantly — single or batch.',
  },
  {
    icon: '🤖',
    title: 'Auto-Extraction',
    body:  'Claude AI extracts vendor, date, and amount automatically.',
  },
  {
    icon: '🔍',
    title: 'Find Fast',
    body:  'Search, filter, and tag receipts for easy access anytime.',
  },
  {
    icon: '📊',
    title: 'Get Insights',
    body:  'View spending trends, category breakdowns, and expense analytics.',
  },
  {
    icon: '📤',
    title: 'Export & Share',
    body:  'Export to CSV for accounting or reimbursement in seconds.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);

  const handleScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActiveIndex(idx);
  }, []);

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const skip = () => finish();

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Main');
  };

  const renderItem = ({ item }) => (
    <View style={s.slide}>
      <View style={s.iconWrap}>
        <Text style={s.icon}>{item.icon}</Text>
      </View>
      <Text style={s.title}>{item.title}</Text>
      <Text style={s.body}>{item.body}</Text>
    </View>
  );

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={s.container}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={s.skipBtn} onPress={skip} activeOpacity={0.7}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
      />

      {/* Dot indicators */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={s.ctaWrap}>
        <TouchableOpacity style={s.ctaBtn} onPress={goNext} activeOpacity={0.9}>
          <Text style={s.ctaText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  skipBtn: {
    position:   'absolute',
    top:        52,
    right:      24,
    zIndex:     10,
    paddingHorizontal: SPACE.md,
    paddingVertical:   SPACE.sm,
  },
  skipText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },

  slide: {
    width:           W,
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 40,
    paddingBottom:   120,
  },
  iconWrap: {
    width:           100,
    height:          100,
    borderRadius:    RADIUS.xxl,
    backgroundColor: COLORS.cardAlt,
    borderWidth:     1,
    borderColor:     COLORS.border,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.xxxl,
  },
  icon:  { fontSize: 46 },
  title: {
    fontSize:      28,
    fontWeight:    '700',
    color:         COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
    marginBottom:  SPACE.lg,
  },
  body: {
    fontSize:   16,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 24,
  },

  dotsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            SPACE.sm,
    marginBottom:   SPACE.xl,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    borderColor:     COLORS.accent,
    width:           20,
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom:     40,
  },
  ctaBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: COLORS.bg },
});
