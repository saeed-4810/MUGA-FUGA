import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;

const getApp = (): FirebaseApp => {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  return app;
};

export const auth = (): Auth => getAuth(getApp());

export const googleSignIn = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth(), provider);
  return cred.user;
};

export const signOut = (): Promise<void> => fbSignOut(auth());

export const onAuthStateChanged = (cb: (user: User | null) => void): (() => void) =>
  fbOnAuthStateChanged(auth(), cb);

export const getIdToken = async (): Promise<string | null> => {
  const u = auth().currentUser;
  if (!u) return null;
  return u.getIdToken();
};
