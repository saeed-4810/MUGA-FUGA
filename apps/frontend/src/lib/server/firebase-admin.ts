import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let app: App | null = null;

const getServiceAccount = (): Record<string, string> | null => {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  return raw ? (JSON.parse(raw) as Record<string, string>) : null;
};

export const getFirebaseAdminApp = (): App => {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const serviceAccount = getServiceAccount();
  app = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });
  return app;
};

export const getFirebaseAdminAuth = () => getAuth(getFirebaseAdminApp());
