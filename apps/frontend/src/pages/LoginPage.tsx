import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export const LoginPage = () => {
  const { t } = useTranslation("auth");
  const { user, signIn, loading } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="font-display text-2xl font-bold">{t("login.title")}</h1>
        <p className="text-ink-muted mt-2 text-sm">{t("login.body")}</p>
        <button
          type="button"
          className="btn-primary mt-6 h-11 w-full"
          onClick={() => void signIn()}
          disabled={loading}
        >
          {t("actions.signInWithGoogle")}
        </button>
      </div>
    </div>
  );
};
