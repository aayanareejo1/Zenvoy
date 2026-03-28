import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  AppState,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useApp } from './AppContext';
import { signInWithEmail, signInWithGoogle } from '../services/auth';
import { COLORS } from '../constants/theme';

const LOCK_AFTER_MS = 15 * 60 * 1000; // 15 minutes

const SessionContext = createContext({ isLocked: false });

export function SessionProvider({ children }) {
  const { user } = useApp();
  const [isLocked, setIsLocked]   = useState(false);
  const [email, setEmail]          = useState('');
  const [password, setPassword]    = useState('');
  const [error, setError]          = useState('');
  const [loading, setLoading]      = useState(false);
  const backgroundAt               = useRef(null);

  // Reset lock when user signs out
  useEffect(() => {
    if (!user) {
      setIsLocked(false);
      backgroundAt.current = null;
    }
  }, [user]);

  // Track app backgrounding; lock on return if threshold exceeded
  useEffect(() => {
    if (!user) return;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundAt.current = Date.now();
      } else if (nextState === 'active' && backgroundAt.current !== null) {
        const elapsed = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (elapsed >= LOCK_AFTER_MS) {
          setIsLocked(true);
          setEmail('');
          setPassword('');
          setError('');
        }
      }
    });

    return () => sub.remove();
  }, [user]);

  const handleEmailReAuth = useCallback(async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      setIsLocked(false);
    } catch {
      setError('Incorrect credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, password]);

  const handleGoogleReAuth = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      setIsLocked(false);
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SessionContext.Provider value={{ isLocked }}>
      {children}
      <Modal visible={isLocked} animationType="fade" transparent={false} statusBarTranslucent>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.inner}>
            <Text style={styles.title}>Session Expired</Text>
            <Text style={styles.subtitle}>
              You were away for more than 15 minutes. Please confirm your identity to continue.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleEmailReAuth}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Continue with Email</Text>
              }
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnAlt, loading && styles.btnDisabled]}
              onPress={handleGoogleReAuth}
              disabled={loading}
            >
              <Text style={styles.btnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnAlt: {
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textTertiary,
    fontSize: 13,
    marginHorizontal: 12,
  },
});
