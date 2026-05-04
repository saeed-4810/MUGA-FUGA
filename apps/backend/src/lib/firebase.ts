import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import type { Env } from "../config/env.js";

let app: App | null = null;

export const initFirebase = (env: Env): App => {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const projectId = env.FIREBASE_PROJECT_ID;
  const storageBucket = env.FIREBASE_STORAGE_BUCKET;

  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<string, string>;
    app = initializeApp({
      credential: cert(credentials),
      projectId,
      storageBucket,
    });
    return app;
  }

  // ADC (Cloud Run / workload identity / GOOGLE_APPLICATION_CREDENTIALS)
  app = initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
  return app;
};

export const auth = (env: Env) => getAuth(initFirebase(env));
export const db = (env: Env) => getFirestore(initFirebase(env));
export const bucket = (env: Env) =>
  getStorage(initFirebase(env)).bucket(env.FIREBASE_STORAGE_BUCKET);
