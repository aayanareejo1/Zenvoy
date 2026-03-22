import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../constants/config';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

export const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  const credential = auth.GoogleAuthProvider.credential(idToken);
  return auth().signInWithCredential(credential);
};

export const signOut = async () => {
  await GoogleSignin.signOut();
  await auth().signOut();
};

export const getCurrentUser = () => auth().currentUser;

export const onAuthStateChanged = (callback) => auth().onAuthStateChanged(callback);
