import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPE, SPACE, RADIUS, BTN_HEIGHT } from '../constants/theme';
import { trackEvent, Events } from '../services/eventTracker';
import { useToast } from '../context/ToastContext';

export const ONBOARDING_KEY = 'onboarding_complete';

const { width: W, height: H } = Dimensions.get('window');

// ─── Step 1: Slide Data ───────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 'welcome',
    illustrationType: 'icon',
    icon: '✦',
    accentIcon: true,
    title: 'Welcome to Zenvoy',
    subtitle: 'Receipts, organized instantly',
  },
  {
    id: 'how_it_works',
    illustrationType: 'steps',
    title: 'Snap. Extract. Done.',
    bullets: [
      { icon: '📷', label: 'Snap a receipt with your camera' },
      { icon: '✨', label: 'AI extracts vendor, date & amount' },
      { icon: '📊', label: 'Track spending across categories' },
    ],
  },
  {
    id: 'camera_permission',
    illustrationType: 'icon',
    icon: '📷',
    title: 'Allow Camera Access',
    body: 'Zenvoy uses your camera to scan receipts. We never store photos in the cloud.',
    hasCta: true,
  },
];

// ─── Step 2: Illustration Components ─────────────────────────────────────────
function StepsIllustration({ bullets }) {
  return (
    <View style={s.stepsRow}>
      {bullets.map((step, i) => (
        <React.Fragment key={i}>
          <View style={s.stepBubble}>
            <Text style={s.stepIcon}>{step.icon}</Text>
          </View>
          {i < bullets.length - 1 && (
            <Text style={s.stepArrow}>→</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function IconIllustration({ icon, accentIcon }) {
  return (
    <View style={s.glowDisc}>
      <Text style={[s.illustrationIcon, accentIcon && s.illustrationIconAccent]}>
        {icon}
      </Text>
    </View>
  );
}

// ─── Step 2: Slide Layout — 3-zone design ────────────────────────────────────
function SlideItem({ item, cameraGranted, onAllowCamera }) {
  return (
    <View style={s.slide}>

      {/* Zone 1 — Illustration (~50% height, centered with teal glow) */}
      <View style={s.illustrationArea}>
        {item.illustrationType === 'steps'
          ? <StepsIllustration bullets={item.bullets} />
          : <IconIllustration icon={item.icon} accentIcon={item.accentIcon} />
        }
      </View>

      {/* Zone 2 — Text block */}
      <View style={s.textBlock}>
        <Text style={s.title}>{item.title}</Text>
        {item.subtitle ? (
          <Text style={s.subtitleText}>{item.subtitle}</Text>
        ) : null}
        {item.body ? (
          <Text style={s.bodyText}>{item.body}</Text>
        ) : null}
        {item.bullets ? (
          <View style={s.bulletList}>
            {item.bullets.map((b, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletIcon}>{b.icon}</Text>
                <Text style={s.bulletLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Zone 3 — Step 3: Camera permission CTA (slide 3 only) */}
      {item.hasCta ? (
        <TouchableOpacity
          style={[s.allowCameraBtn, cameraGranted && s.allowCameraBtnGranted]}
          onPress={onAllowCamera}
          activeOpacity={0.85}
        >
          <Text style={[s.allowCameraText, cameraGranted && s.allowCameraTextGranted]}>
            {cameraGranted ? '✓ Permission Granted' : 'Allow Camera Access'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={s.ctaSlot} />
      )}

    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cameraGranted, setCameraGranted] = useState(false);
  const listRef = useRef(null);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const handleScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActiveIndex(idx);
  }, []);

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    finish();
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    trackEvent(Events.ONBOARDING_COMPLETED);
    navigation.replace('Main');
  };

  // ─── Step 3: Camera Permission Flow ──────────────────────────────────────
  const handleAllowCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setCameraGranted(true);
    } else {
      showToast({ message: 'You can enable this later in Settings', type: 'info' });
    }
  };

  const isLast = activeIndex === SLIDES.length - 1;

  // ─── Step 5: Safe-area insets ─────────────────────────────────────────────
  const skipTop = insets.top + 12;
  const ctaBottom = insets.bottom + 16;

  return (
    <View style={s.container}>
      {/* Skip — visible on slides 1 & 2 only */}
      {!isLast && (
        <TouchableOpacity
          style={[s.skipBtn, { top: skipTop }]}
          onPress={skip}
          activeOpacity={0.7}
        >
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SlideItem
            item={item}
            cameraGranted={cameraGranted}
            onAllowCamera={handleAllowCamera}
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
      />

      {/* Dot indicators — 3 dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
        ))}
      </View>

      {/* Primary CTA */}
      <View style={[s.ctaWrap, { paddingBottom: ctaBottom }]}>
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
    position:          'absolute',
    right:             24,
    zIndex:            10,
    paddingHorizontal: SPACE.md,
    paddingVertical:   SPACE.sm,
  },
  skipText: { ...TYPE.callout, color: COLORS.textSecondary },

  // ── Slide ──
  slide: {
    width:             W,
    flex:              1,
    paddingHorizontal: 32,
  },

  // ── Zone 1: Illustration ──
  illustrationArea: {
    height:          H * 0.45,
    justifyContent:  'center',
    alignItems:      'center',
  },
  glowDisc: {
    width:            200,
    height:           200,
    borderRadius:     100,
    backgroundColor:  COLORS.accentGlow,
    justifyContent:   'center',
    alignItems:       'center',
  },
  illustrationIcon: {
    fontSize: 80,
  },
  illustrationIconAccent: {
    fontSize: 72,
    color:    COLORS.accent,
  },

  // Steps (slide 2)
  stepsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACE.md,
  },
  stepBubble: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: COLORS.accentGlow,
    borderWidth:     1,
    borderColor:     COLORS.accent + '44',
    justifyContent:  'center',
    alignItems:      'center',
  },
  stepIcon:  { fontSize: 30 },
  stepArrow: { fontSize: 20, color: COLORS.accent, fontWeight: '600' },

  // ── Zone 2: Text ──
  textBlock: {
    paddingTop: SPACE.xxl,
  },
  title: {
    ...TYPE.hero,
    fontSize:     30,
    marginBottom: SPACE.lg,
    textAlign:    'center',
  },
  subtitleText: {
    ...TYPE.body,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 26,
  },
  bodyText: {
    ...TYPE.body,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 26,
  },
  bulletList: {
    gap:       SPACE.lg,
    marginTop: SPACE.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACE.md,
  },
  bulletIcon: {
    fontSize:  22,
    width:     32,
    textAlign: 'center',
  },
  bulletLabel: {
    ...TYPE.body,
    color: COLORS.textSecondary,
    flex:  1,
  },

  // ── Zone 3: Camera permission CTA ──
  allowCameraBtn: {
    marginTop:       SPACE.xxl,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    borderWidth:     1.5,
    borderColor:     COLORS.accent,
    justifyContent:  'center',
    alignItems:      'center',
  },
  allowCameraBtnGranted: {
    backgroundColor: COLORS.successMuted,
    borderColor:     COLORS.success,
  },
  allowCameraText: {
    ...TYPE.callout,
    color: COLORS.accent,
  },
  allowCameraTextGranted: {
    color: COLORS.success,
  },

  // ── Placeholder for slides without a Zone 3 CTA ──
  ctaSlot: { height: SPACE.xxl },

  // ── Dots ──
  dotsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            SPACE.sm,
    marginBottom:   SPACE.xl,
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: COLORS.cardAlt,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    borderColor:     COLORS.accent,
    width:           20,
  },

  // ── Primary CTA ──
  ctaWrap: {
    paddingHorizontal: 24,
  },
  ctaBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
});
