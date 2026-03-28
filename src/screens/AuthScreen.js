/**
 * AuthScreen — email / phone sign-in with animated toggle.
 * Replaces the Google + Apple buttons in the signed-out view.
 *
 * "Haiku utilities" referenced in the design brief do not exist in this
 * codebase, so SPRING_CONFIGS, TEST_IDS, and A11Y_LABELS are defined
 * inline below and follow the same contract.
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Animated, Easing, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { signInWithEmail, signUpWithEmail, sendPhoneOtp } from '../services/auth';
import {
  COLORS, ELEVATION, RADIUS, BTN_HEIGHT, H_PAD, SPACE,
} from '../constants/theme';
import { FREE_MONTHLY_LIMIT } from '../constants/config';

// ─── Module-level constants (Haiku contract fulfilled inline) ──────────────────

const SPRING_CONFIGS = {
  pressIn:  { speed: 30, bounciness: 0, useNativeDriver: true },
  pressOut: { speed: 30, bounciness: 4, useNativeDriver: true },
};

const TEST_IDS = {
  authModeToggle:   'auth-mode-toggle',
  flowToggle:       'auth-flow-toggle',
  signInFlowBtn:    'auth-flow-sign-in-btn',
  signUpFlowBtn:    'auth-flow-sign-up-btn',
  emailModeBtn:     'auth-mode-email-btn',
  phoneModeBtn:     'auth-mode-phone-btn',
  emailInput:       'auth-email-input',
  passwordInput:    'auth-password-input',
  confirmPwdInput:  'auth-confirm-password-input',
  signInButton:     'auth-sign-in-btn',
  phoneInput:       'auth-phone-input',
  getOtpButton:     'auth-get-otp-btn',
  errorMessage:     'auth-error-msg',
};

const A11Y_LABELS = {
  emailModeBtn:    'Switch to email sign in',
  phoneModeBtn:    'Switch to phone sign in',
  emailInput:      'Email address',
  passwordInput:   'Password',
  confirmPwdInput: 'Confirm password',
  signInButton:    'Sign in with email and password',
  signUpButton:    'Create account',
  phoneInput:      'Phone number',
  getOtpButton:    'Get one-time password',
};

const FEATURES = [
  { icon: '☁️', text: 'Automatic cloud backup' },
  { icon: '📱', text: 'Restore on any device' },
  { icon: '♾',  text: `Unlimited scans (free: ${FREE_MONTHLY_LIMIT}/month)` },
  { icon: '📊', text: 'Reports & CSV export' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Validate RFC-5322-lite email. */
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Validate E.164 (digits only after stripping spaces). */
const isValidPhone = (s) => /^\+[1-9]\d{7,14}$/.test(s.replace(/\s/g, ''));

/**
 * Pretty-print a raw phone string on blur.
 * "+15551234567" → "+1 555 123 4567"
 */
function formatPhoneNumber(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 11) return raw; // not enough to format
  const cc  = digits.slice(0, digits.length - 10);
  const num = digits.slice(-10);
  return `+${cc} ${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`;
}

/** Map Firebase auth error codes to user-friendly strings. */
function authErrorMessage(code) {
  const map = {
    'auth/invalid-email':          'Invalid email address.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/user-not-found':         'No account found for this email.',
    'auth/too-many-requests':      'Too many attempts — try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/phone-not-configured':   'Phone sign-in is coming soon. Use email for now.',
    'auth/invalid-credential':     'Invalid email or password.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Zenvoy logo mark, heading, and tagline. */
export const ZenvoyBranding = () => (
  <View style={s.brandWrap}>
    <View style={s.logoMark}>
      <Text style={s.logoMarkText}>Z</Text>
    </View>
    <Text style={s.brandTitle}>Zenvoy</Text>
    <Text style={s.brandTagline}>Back up your receipts.{'\n'}Access anywhere.</Text>
  </View>
);

/** Four benefit rows inside a card. */
export const FeaturesList = () => (
  <View style={s.featuresList}>
    {FEATURES.map(({ icon, text }) => (
      <View key={text} style={s.featureRow}>
        <Text style={s.featureIcon}>{icon}</Text>
        <Text style={s.featureText}>{text}</Text>
      </View>
    ))}
  </View>
);

/**
 * Segmented Sign In / Sign Up toggle.
 */
export const FlowToggle = ({ activeFlow, onFlowChange }) => {
  const signInScale = useRef(new Animated.Value(1)).current;
  const signUpScale = useRef(new Animated.Value(1)).current;

  const pressSegment = (anim, flow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(anim, { toValue: 0.95, ...SPRING_CONFIGS.pressIn }).start(() =>
      Animated.spring(anim, { toValue: 1, ...SPRING_CONFIGS.pressOut }).start()
    );
    onFlowChange(flow);
  };

  return (
    <View style={s.toggleWrap} testID={TEST_IDS.flowToggle}>
      {[
        { flow: 'signIn', label: 'Sign In', anim: signInScale, testID: TEST_IDS.signInFlowBtn },
        { flow: 'signUp', label: 'Sign Up', anim: signUpScale, testID: TEST_IDS.signUpFlowBtn },
      ].map(({ flow, label, anim, testID }) => (
        <Animated.View key={flow} style={[s.toggleSegmentWrap, { transform: [{ scale: anim }] }]}>
          <TouchableOpacity
            style={[s.toggleSegment, activeFlow === flow && s.toggleSegmentActive]}
            onPress={() => pressSegment(anim, flow)}
            activeOpacity={0.85}
            testID={testID}
          >
            <Text style={[s.toggleTxt, activeFlow === flow && s.toggleTxtActive]}>{label}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
};

/**
 * Segmented Email / Phone toggle.
 * Each segment has an independent spring scale on press.
 */
export const AuthModeToggle = ({ activeMode, onModeChange }) => {
  const emailScale = useRef(new Animated.Value(1)).current;
  const phoneScale = useRef(new Animated.Value(1)).current;

  const pressSegment = (anim, mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(anim, { toValue: 0.95, ...SPRING_CONFIGS.pressIn }).start(() =>
      Animated.spring(anim, { toValue: 1, ...SPRING_CONFIGS.pressOut }).start()
    );
    onModeChange(mode);
  };

  return (
    <View style={s.toggleWrap} testID={TEST_IDS.authModeToggle}>
      {[
        { mode: 'email', label: 'Email', anim: emailScale, testID: TEST_IDS.emailModeBtn, a11y: A11Y_LABELS.emailModeBtn },
        { mode: 'phone', label: 'Phone', anim: phoneScale, testID: TEST_IDS.phoneModeBtn, a11y: A11Y_LABELS.phoneModeBtn },
      ].map(({ mode, label, anim, testID, a11y }) => (
        <Animated.View key={mode} style={[s.toggleSegmentWrap, { transform: [{ scale: anim }] }]}>
          <TouchableOpacity
            style={[s.toggleSegment, activeMode === mode && s.toggleSegmentActive]}
            onPress={() => pressSegment(anim, mode)}
            activeOpacity={0.85}
            testID={testID}
            accessibilityLabel={a11y}
          >
            <Text style={[s.toggleTxt, activeMode === mode && s.toggleTxtActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
};

/** Password strength: returns 'weak' | 'medium' | 'strong' */
function getPasswordStrength(pw) {
  if (!pw) return null;
  if (pw.length < 6)  return 'weak';
  if (pw.length <= 10) return 'medium';
  return 'strong';
}

const STRENGTH_COLOR = {
  weak:   COLORS.danger,
  medium: COLORS.warning,
  strong: COLORS.success,
};

const STRENGTH_WIDTH = { weak: '33%', medium: '66%', strong: '100%' };

/**
 * Email + password form with animated error fade-in.
 * Supports both sign-in and sign-up (isSignUp adds confirm password field).
 */
export const EmailForm = ({
  email, password, confirmPassword,
  onEmailChange, onPasswordChange, onConfirmPasswordChange,
  onSubmit, loading, error, isSignUp, navigation,
}) => {
  const btnScale     = useRef(new Animated.Value(1)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (error) {
      errorOpacity.setValue(0);
      Animated.timing(errorOpacity, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [error]);

  const pressIn  = () => Animated.spring(btnScale, { toValue: 0.97, ...SPRING_CONFIGS.pressIn  }).start();
  const pressOut = () => Animated.spring(btnScale, { toValue: 1,    ...SPRING_CONFIGS.pressOut }).start();

  const disabled = !email || !password || (isSignUp && !confirmPassword) || loading;
  const strength = isSignUp ? getPasswordStrength(password) : null;

  return (
    <View style={s.formWrap}>
      <TextInput
        style={s.input}
        placeholder="Enter email"
        placeholderTextColor={COLORS.textTertiary}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        testID={TEST_IDS.emailInput}
        accessibilityLabel={A11Y_LABELS.emailInput}
      />

      {/* Password input with eye toggle */}
      <View style={s.inputWrap}>
        <TextInput
          style={[s.input, s.inputWithIcon]}
          placeholder="Enter password"
          placeholderTextColor={COLORS.textTertiary}
          value={password}
          onChangeText={onPasswordChange}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          testID={TEST_IDS.passwordInput}
          accessibilityLabel={A11Y_LABELS.passwordInput}
        />
        <TouchableOpacity
          style={s.eyeBtn}
          onPress={() => setShowPassword(v => !v)}
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={COLORS.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Password strength meter — sign up only */}
      {isSignUp && strength && (
        <View style={s.strengthTrack}>
          <View style={[s.strengthBar, { width: STRENGTH_WIDTH[strength], backgroundColor: STRENGTH_COLOR[strength] }]} />
        </View>
      )}

      {/* Confirm password with eye toggle — sign up only */}
      {isSignUp && (
        <View style={s.inputWrap}>
          <TextInput
            style={[s.input, s.inputWithIcon]}
            placeholder="Confirm password"
            placeholderTextColor={COLORS.textTertiary}
            value={confirmPassword}
            onChangeText={onConfirmPasswordChange}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            testID={TEST_IDS.confirmPwdInput}
            accessibilityLabel={A11Y_LABELS.confirmPwdInput}
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowConfirmPassword(v => !v)}
            accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={COLORS.textTertiary}
            />
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <Animated.Text
          style={[s.errorText, { opacity: errorOpacity }]}
          testID={TEST_IDS.errorMessage}
        >
          {error}
        </Animated.Text>
      ) : null}

      <Animated.View style={[s.btnGlow, { transform: [{ scale: btnScale }], opacity: disabled ? 0.5 : 1 }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={onSubmit}
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={disabled}
          activeOpacity={0.9}
          testID={TEST_IDS.signInButton}
          accessibilityLabel={isSignUp ? A11Y_LABELS.signUpButton : A11Y_LABELS.signInButton}
        >
          {loading
            ? <ActivityIndicator color={COLORS.bg} size="small" />
            : <Text style={s.primaryBtnTxt}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
        </TouchableOpacity>
      </Animated.View>

      {/* Forgot Password link — sign in only */}
      {!isSignUp && navigation && (
        <TouchableOpacity
          style={s.forgotLink}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={s.forgotLinkTxt}>Forgot Password?</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Phone-only form.
 * Formats phone number on blur; Get OTP button disabled until E.164 valid.
 */
export const PhoneForm = ({ phone, onPhoneChange, onSubmit, loading, error }) => {
  const btnScale     = useRef(new Animated.Value(1)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      errorOpacity.setValue(0);
      Animated.timing(errorOpacity, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [error]);

  const pressIn  = () => Animated.spring(btnScale, { toValue: 0.97, ...SPRING_CONFIGS.pressIn  }).start();
  const pressOut = () => Animated.spring(btnScale, { toValue: 1,    ...SPRING_CONFIGS.pressOut }).start();

  const disabled = !isValidPhone(phone) || loading;

  return (
    <View style={s.formWrap}>
      <TextInput
        style={s.input}
        placeholder="+1 (555) 123-4567"
        placeholderTextColor={COLORS.textTertiary}
        value={phone}
        onChangeText={onPhoneChange}
        onBlur={() => onPhoneChange(formatPhoneNumber(phone))}
        keyboardType="phone-pad"
        testID={TEST_IDS.phoneInput}
        accessibilityLabel={A11Y_LABELS.phoneInput}
      />

      {error ? (
        <Animated.Text
          style={[s.errorText, { opacity: errorOpacity }]}
          testID={TEST_IDS.errorMessage}
        >
          {error}
        </Animated.Text>
      ) : null}

      <Animated.View style={[s.btnGlow, { transform: [{ scale: btnScale }], opacity: disabled ? 0.5 : 1 }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={onSubmit}
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={disabled}
          activeOpacity={0.9}
          testID={TEST_IDS.getOtpButton}
          accessibilityLabel={A11Y_LABELS.getOtpButton}
        >
          {loading
            ? <ActivityIndicator color={COLORS.bg} size="small" />
            : <Text style={s.primaryBtnTxt}>Get OTP</Text>}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AuthScreen({ navigation }) {
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone,           setPhone]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [authFlow,        setAuthFlow]        = useState('signIn'); // 'signIn' | 'signUp'
  const [authMode,        setAuthMode]        = useState('email');  // 'email' | 'phone'

  const isEmailValid = useMemo(() => isValidEmail(email), [email]);
  const isPhoneValid = useMemo(() => isValidPhone(phone), [phone]);

  const wrapChange = useCallback((setter) => (value) => {
    setError(null);
    setter(value);
  }, []);

  const handleFlowChange = useCallback((flow) => {
    setAuthFlow(flow);
    setError(null);
    setConfirmPassword('');
  }, []);

  const handleModeChange = useCallback((mode) => {
    setAuthMode(mode);
    setError(null);
  }, []);

  const handleEmailSignIn = useCallback(async () => {
    if (!isEmailValid || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e.code || e.message));
    } finally {
      setLoading(false);
    }
  }, [email, password, isEmailValid]);

  const handleEmailSignUp = useCallback(async () => {
    if (!isEmailValid || !password || !confirmPassword) return;
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e.code || e.message));
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, isEmailValid]);

  const handlePhoneGetOTP = useCallback(async () => {
    if (!isPhoneValid) return;
    setLoading(true);
    setError(null);
    try {
      await sendPhoneOtp(phone.replace(/\s/g, ''));
    } catch (e) {
      setError(authErrorMessage(e.code || e.message));
    } finally {
      setLoading(false);
    }
  }, [phone, isPhoneValid]);

  const isSignUp = authFlow === 'signUp';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ZenvoyBranding />
        <FeaturesList />

        <FlowToggle activeFlow={authFlow} onFlowChange={handleFlowChange} />

        {!isSignUp && (
          <AuthModeToggle activeMode={authMode} onModeChange={handleModeChange} />
        )}

        {authMode === 'email' || isSignUp ? (
          <EmailForm
            email={email}
            password={password}
            confirmPassword={confirmPassword}
            onEmailChange={wrapChange(setEmail)}
            onPasswordChange={wrapChange(setPassword)}
            onConfirmPasswordChange={wrapChange(setConfirmPassword)}
            onSubmit={isSignUp ? handleEmailSignUp : handleEmailSignIn}
            loading={loading}
            error={error}
            isSignUp={isSignUp}
            navigation={navigation}
          />
        ) : (
          <PhoneForm
            phone={phone}
            onPhoneChange={wrapChange(setPhone)}
            onSubmit={handlePhoneGetOTP}
            loading={loading}
            error={error}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Root
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  scroll:  { flex: 1 },
  content: {
    alignItems:        'center',
    paddingHorizontal: H_PAD,
    paddingTop:        SPACE.xxxl,
    paddingBottom:     SPACE.huge,
  },

  // ── Branding
  brandWrap: {
    alignItems:   'center',
    marginBottom: SPACE.xxxl,
    gap:          SPACE.sm,
  },
  logoMark: {
    width:           56,
    height:          56,
    borderRadius:    RADIUS.xl,
    backgroundColor: COLORS.accentMuted,
    borderWidth:     1,
    borderColor:     COLORS.accent + '50',
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    SPACE.xs,
  },
  logoMarkText: { fontSize: 26, fontWeight: '800', color: COLORS.accent },
  brandTitle:   { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  brandTagline: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },

  // ── Features card
  featuresList: {
    alignSelf:       'stretch',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    padding:         SPACE.lg,
    marginBottom:    SPACE.xxxl,
    gap:             SPACE.md,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     COLORS.border,
  },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  featureIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  featureText: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '500', flex: 1 },

  // ── Auth mode toggle (segmented control)
  toggleWrap: {
    flexDirection:   'row',
    alignSelf:       'stretch',
    backgroundColor: COLORS.cardAlt,
    borderRadius:    RADIUS.button,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         3,
    marginBottom:    SPACE.lg,
  },
  toggleSegmentWrap: { flex: 1 },
  toggleSegment: {
    flex:           1,
    height:         36,
    borderRadius:   RADIUS.button - 2,
    justifyContent: 'center',
    alignItems:     'center',
  },
  toggleSegmentActive: {
    backgroundColor: COLORS.accent,
    ...ELEVATION.card,
  },
  toggleTxt:       { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  toggleTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // ── Shared form layout
  formWrap: { alignSelf: 'stretch', gap: SPACE.md },

  // ── Text inputs
  input: {
    height:            BTN_HEIGHT,
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.lg,
    fontSize:          15,
    color:             COLORS.textPrimary,
  },
  inputWrap: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: BTN_HEIGHT, // leave room for eye button
  },
  eyeBtn: {
    position:       'absolute',
    right:          0,
    top:            0,
    bottom:         0,
    width:          BTN_HEIGHT,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Password strength meter
  strengthTrack: {
    height:          4,
    backgroundColor: COLORS.border,
    borderRadius:    RADIUS.pill,
    overflow:        'hidden',
    marginTop:       -SPACE.sm,
  },
  strengthBar: {
    height:       4,
    borderRadius: RADIUS.pill,
  },

  // ── Forgot password
  forgotLink: {
    alignItems:     'center',
    paddingVertical: SPACE.xs,
  },
  forgotLinkTxt: {
    fontSize:   14,
    color:      COLORS.accent,
    fontWeight: '500',
  },

  // ── Error message
  errorText: {
    fontSize:   12,
    color:      COLORS.danger,
    fontWeight: '500',
    marginTop:  -SPACE.xs,
  },

  // ── Primary CTA
  btnGlow: {
    borderRadius: RADIUS.button,
    ...ELEVATION.glow,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     COLORS.accent + '55',
  },
  primaryBtnTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.2 },
});
