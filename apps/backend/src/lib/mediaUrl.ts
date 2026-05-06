import type { Env } from "../config/env.js";

export const storageMediaUrl = (env: Env, objectPath: string): string => {
  const encodedPath = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${env.FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
};
