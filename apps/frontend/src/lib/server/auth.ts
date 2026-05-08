import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { MugaUser } from "../../context/AuthContext";

import { getFirebaseAdminAuth } from "./firebase-admin";
import { SESSION_COOKIE_NAME, verifyServerSessionCookie, type Role } from "./session";

export interface ServerSession {
  sessionCookie: string;
  user: MugaUser;
}

const E2E_COOKIE_NAME = "muga.e2e-user";

const isRole = (value: unknown): value is Role => value === "admin" || value === "customer";

const parseE2eUser = (value: string | undefined): MugaUser | null => {
  if (process.env["E2E_AUTH_BYPASS"] !== "1" || !value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<MugaUser>;
    if (!parsed.uid || !parsed.email || !isRole(parsed.role)) return null;
    return {
      uid: parsed.uid,
      email: parsed.email,
      role: parsed.role,
      ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
      ...(parsed.photoURL !== undefined ? { photoURL: parsed.photoURL } : {}),
    };
  } catch {
    return null;
  }
};

export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const cookieStore = await cookies();
  const e2eUser = parseE2eUser(cookieStore.get(E2E_COOKIE_NAME)?.value);
  if (e2eUser) return { sessionCookie: "e2e-session", user: e2eUser };

  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyServerSessionCookie(getFirebaseAdminAuth(), sessionCookie);
  if (session.status !== "authenticated" || !sessionCookie) return null;
  return { sessionCookie, user: session.user };
});

export const requireServerSession = async (): Promise<ServerSession> => {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
};

export const requireServerRole = async (role: Role): Promise<ServerSession> => {
  const session = await requireServerSession();
  if (session.user.role !== role) redirect("/");
  return session;
};
