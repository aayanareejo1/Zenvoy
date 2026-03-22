import { getAuth, GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged } from '@react-native-firebase/auth';
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

export const getCurrentUser = () => auth.currentUser;

export const onAuthStateChanged = (callback) => firebaseOnAuthStateChanged(auth, callback);
