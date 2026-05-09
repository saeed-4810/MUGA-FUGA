import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { switchRoleOnServer } from "../features/auth/role-switch-action";
import { api } from "../lib/api";
import { onAuthStateChanged, googleSignIn, signOut, getCurrentUser } from "../lib/firebase";
import { createSession, destroySession } from "../lib/session-client";

export type Role = "admin" | "customer";

export interface MugaUser {
  uid: string;
  email: string;
  role: Role;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextValue {
  user: MugaUser | null;
  loading: boolean;
  switchingRole: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const isLocalhostUrl = (url: string): boolean => new URL(url).hostname === "localhost";

export const readLocalhostE2eUser = (url: string, storage: Storage): string | null => {
  if (!isLocalhostUrl(url)) return null;
  return storage.getItem("muga:e2e-user");
};

export const AuthProvider = ({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: MugaUser | null;
}) => {
  const [user, setUser] = useState<MugaUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const [switchingRole, setSwitchingRole] = useState(false);

  useEffect(() => {
    const e2eUser = readLocalhostE2eUser(window.location.href, sessionStorage);
    if (e2eUser) {
      setUser(JSON.parse(e2eUser) as MugaUser);
      setLoading(false);
      return () => undefined;
    }
    const unsub = onAuthStateChanged(async (fb: User | null) => {
      if (!fb) {
        if (!initialUser) setUser(null);
        setLoading(false);
        return;
      }
      try {
        const me = await api.post<{ uid: string; email: string; role: Role }>("/me/bootstrap", {});
        await fb.getIdToken(true);
        await createSession(fb);
        setUser({
          uid: me.uid,
          email: me.email,
          role: me.role,
          displayName: fb.displayName,
          photoURL: fb.photoURL,
        });
      } catch {
        setUser({
          uid: fb.uid,
          email: fb.email ?? "",
          role: "customer",
          displayName: fb.displayName,
          photoURL: fb.photoURL,
        });
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      switchingRole,
      signIn: async () => {
        await googleSignIn();
      },
      signOut: async () => {
        await destroySession();
        await signOut();
        setUser(null);
      },
      switchRole: async (role: Role) => {
        const firebaseUser = getCurrentUser();
        if (!firebaseUser) throw new Error("No active Firebase user for role switch.");

        setSwitchingRole(true);
        try {
          const updated = await switchRoleOnServer(role);
          if (!updated.ok) throw new Error(updated.message);
          await firebaseUser.getIdToken(true);
          await createSession(firebaseUser);
          setUser((current) =>
            current
              ? { ...current, uid: updated.uid, email: updated.email, role: updated.role }
              : { uid: updated.uid, email: updated.email, role: updated.role }
          );
        } finally {
          setSwitchingRole(false);
        }
      },
    }),
    [user, loading, switchingRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
};
