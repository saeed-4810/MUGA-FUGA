import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

interface RequireAuthProps {
  children: React.ReactNode;
  role?: "admin" | "customer";
}

export const RequireAuth = ({ children, role }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation("auth");
  if (loading) {
    return (
      <div className="text-ink-muted grid min-h-[40vh] place-items-center" aria-busy="true">
        {t("status.loading")}
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return (
      <div className="card mx-auto max-w-md p-6 text-center" role="alert">
        <h2 className="text-lg font-semibold">{t("guard.forbiddenTitle")}</h2>
        <p className="text-ink-muted mt-2 text-sm">{t("guard.forbiddenBody")}</p>
      </div>
    );
  }
  return <>{children}</>;
};
