import type { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../lib/api";
import { onAuthStateChanged, googleSignIn, signOut } from "../lib/firebase";

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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MugaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (fb: User | null) => {
      if (!fb) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        // Server bootstraps custom claims (admin if email matches INITIAL_ADMIN_EMAILS)
        const me = await api.post<{ uid: string; email: string; role: Role }>("/me/bootstrap", {});
        // Force refresh ID token so the new claim appears immediately
        await fb.getIdToken(true);
        setUser({
          uid: me.uid,
          email: me.email,
          role: me.role,
          displayName: fb.displayName,
          photoURL: fb.photoURL,
        });
      } catch {
        // If bootstrap fails (e.g. backend down), fall back to a customer with claims-as-is
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
      signIn: async () => {
        await googleSignIn();
      },
      signOut: async () => {
        await signOut();
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
};
