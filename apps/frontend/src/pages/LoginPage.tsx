import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../lib/firebase";

export const LoginPage = () => {
  const { t } = useTranslation("auth");
  const { user, signIn, loading } = useAuth();
  if (user) return <Navigate to="/" replace />;
  const firebaseReady = isFirebaseConfigured();
  return (
    <div className="mx-auto max-w-md">
      {/*
        Pre-auth chrome: brand mark + locale + theme controls. Unauthenticated
        users still get i18n + dark mode. Also covers E-SHELL-001 (landing
        renders MUGA, theme toggle, locale switcher without requiring auth).
      */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-2xl font-bold tracking-tight">MUGA</div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <div className="card p-8">
        <h1 className="font-display text-2xl font-bold">{t("login.title")}</h1>
        <p className="text-ink-muted mt-2 text-sm">{t("login.body")}</p>
        {!firebaseReady && (
          <p
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-200"
            role="status"
          >
            {t("login.unconfigured")}
          </p>
        )}
        <button
          type="button"
          className="btn-primary mt-6 h-11 w-full"
          onClick={() => void signIn()}
          disabled={loading || !firebaseReady}
        >
          {t("actions.signInWithGoogle")}
        </button>
      </div>
    </div>
  );
};
