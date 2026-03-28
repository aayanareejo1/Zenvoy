import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../constants/config';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

const auth = getAuth();

export const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
};

export const signOut = async () => {
  await GoogleSignin.signOut();
  await firebaseSignOut(auth);
};

/** Sign in with email + password via Firebase Auth. */
export const signInWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

/** Create a new account with email + password via Firebase Auth. */
export const signUpWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

/**
 * Initiate phone OTP flow.
 * @todo Wire up signInWithPhoneNumber once SHA-1 + reCAPTCHA are configured.
 */
export const sendPhoneOtp = async (_phone) => {
  throw Object.assign(new Error('Phone sign-in is coming soon. Use email for now.'), { code: 'auth/phone-not-configured' });
};

export const getCurrentUser = () => auth.currentUser;

export const onAuthStateChanged = (callback) => firebaseOnAuthStateChanged(auth, callback);

export const sendPasswordResetEmail = async (email) => {
  await firebaseSendPasswordResetEmail(auth, email);
};

export const verifyPasswordResetCode = async (code) => {
  return auth.verifyPasswordResetCode(code);
};

export const confirmPasswordReset = async (code, newPassword) => {
  return auth.confirmPasswordReset(code, newPassword);
};

export const signInAsGuest = async () => {
  return getAuth().signInAnonymously();
};

export const isGuestUser = () => !!(getAuth().currentUser?.isAnonymous);
