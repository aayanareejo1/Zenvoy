import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { sendPasswordResetEmail } from '../services/auth';
import { useToast } from '../context/ToastContext';
import { COLORS, RADIUS, BTN_HEIGHT, H_PAD, SPACE, ELEVATION } from '../constants/theme';

function resetErrorMessage(code) {
  const map = {
    'auth/user-not-found':         'No account found for this email address.',
    'auth/invalid-email':          'Invalid email address.',
    'auth/too-many-requests':      'Too many attempts — please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const { showToast } = useToast();

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await sendPasswordResetEmail(trimmed);
      setSent(true);
    } catch (e) {
      showToast({ message: resetErrorMessage(e.code), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!sent ? (
          /* ── Step 1: Email input ─────────────────────────────── */
          <View style={s.card}>
            <Text style={s.title}>Reset Password</Text>
            <Text style={s.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>

            <TextInput
              style={s.input}
              placeholder="Enter email"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <TouchableOpacity
              style={[s.primaryBtn, (!email.trim() || loading) && s.btnDisabled]}
              onPress={handleSend}
              disabled={!email.trim() || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COLORS.bg} size="small" />
                : <Text style={s.primaryBtnTxt}>Send Reset Link</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.backLink} onPress={() => navigation.goBack()}>
              <Text style={s.backLinkTxt}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Step 2 & 3: Success + back to auth ─────────────── */
          <View style={s.card}>
            <View style={s.iconWrap}>
              <Text style={s.iconText}>✉️</Text>
            </View>
            <Text style={s.title}>Check Your Email</Text>
            <Text style={s.subtitle}>
              We sent a password reset link to{'\n'}
              <Text style={s.emailHighlight}>{email.trim()}</Text>
            </Text>
            <Text style={s.hint}>
              Didn't receive it? Check your spam folder or try again.
            </Text>

            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnTxt}>Back to Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.backLink}
              onPress={() => { setSent(false); setEmail(''); }}
            >
              <Text style={s.backLinkTxt}>Try a different email</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flex:              1,
    justifyContent:    'center',
    paddingHorizontal: H_PAD,
    paddingVertical:   SPACE.xxxl,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACE.xl,
    gap:             SPACE.lg,
    ...ELEVATION.card,
  },

  iconWrap: {
    alignItems:   'center',
    marginBottom: SPACE.xs,
  },
  iconText: { fontSize: 48 },

  title: {
    fontSize:    22,
    fontWeight:  '700',
    color:       COLORS.textPrimary,
    letterSpacing: -0.3,
    textAlign:   'center',
  },
  subtitle: {
    fontSize:   14,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: 21,
  },
  emailHighlight: {
    color:      COLORS.accent,
    fontWeight: '600',
  },
  hint: {
    fontSize:  13,
    color:     COLORS.textTertiary,
    textAlign: 'center',
  },

  input: {
    height:            BTN_HEIGHT,
    backgroundColor:   COLORS.cardAlt,
    borderRadius:      RADIUS.input,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACE.lg,
    fontSize:          15,
    color:             COLORS.textPrimary,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    height:          BTN_HEIGHT,
    borderRadius:    RADIUS.button,
    justifyContent:  'center',
    alignItems:      'center',
    ...ELEVATION.glow,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnTxt: {
    fontSize:   16,
    fontWeight: '700',
    color:      COLORS.textPrimary,
  },

  backLink: {
    alignItems: 'center',
    paddingVertical: SPACE.xs,
  },
  backLinkTxt: {
    fontSize:   14,
    color:      COLORS.accent,
    fontWeight: '500',
  },
});
