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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    ? { measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID }
    : {}),
};

/**
 * When the Firebase config is absent (e.g. the CI E2E preview build that runs
 * without real envs, or a dev forgets `.env.local`) we must not crash the
 * whole app on boot. Instead: render the shell + show login as "sign-in
 * unavailable". This predicate gates every call site.
 */
export const isFirebaseConfigured = (): boolean =>
  Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;

const getApp = (): FirebaseApp | null => {
  if (!isFirebaseConfigured()) return null;
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  return app;
};

export const auth = (): Auth | null => {
  const a = getApp();
  return a ? getAuth(a) : null;
};

export const googleSignIn = async (): Promise<User> => {
  const a = auth();
  if (!a) throw new Error("Firebase is not configured in this environment.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(a, provider);
  return cred.user;
};

export const signOut = async (): Promise<void> => {
  const a = auth();
  if (!a) return;
  await fbSignOut(a);
};

export const onAuthStateChanged = (cb: (user: User | null) => void): (() => void) => {
  const a = auth();
  if (!a) {
    queueMicrotask(() => cb(null));
    return () => undefined;
  }
  return fbOnAuthStateChanged(a, cb);
};

export const getIdToken = async (): Promise<string | null> => {
  if (readLocalhostE2eToken(window.location.href, sessionStorage)) return "e2e-token";
  const a = auth();
  if (!a) return null;
  const u = a.currentUser;
  if (!u) return null;
  return u.getIdToken();
};

export const getCurrentUser = (): User | null => auth()?.currentUser ?? null;

const readLocalhostE2eToken = (url: string, storage: Storage): string | null => {
  if (new URL(url).hostname !== "localhost") return null;
  return storage.getItem("muga:e2e-user");
};
