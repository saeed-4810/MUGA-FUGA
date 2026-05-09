import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Role, useAuth } from "../context/AuthContext";

const getNextRole = (role: Role): Role => (role === "admin" ? "customer" : "admin");

export const RoleSwitchToggle = () => {
  const { t } = useTranslation("auth");
  const { user, loading, switchingRole, switchRole } = useAuth();
  const [roleSwitchMessage, setRoleSwitchMessage] = useState("");

  if (loading || !user) {
    return null;
  }

  const isAdminMode = user.role === "admin";
  const nextRole = getNextRole(user.role);

  const handleRoleSwitch = async () => {
    setRoleSwitchMessage("");
    try {
      await switchRole(nextRole);
      setRoleSwitchMessage(t("role.switchSuccess"));
    } catch {
      setRoleSwitchMessage(t("role.switchError"));
    }
  };

  return (
    <aside
      aria-label={t("role.switchLabel")}
      className="fixed inset-x-4 bottom-4 z-40 flex justify-center sm:bottom-6"
    >
      <div className="border-line bg-surface/95 text-ink shadow-soft flex min-h-12 max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border px-3 py-2 backdrop-blur">
        <span className="bg-accent/20 text-primary dark:text-accent rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide">
          Demo
        </span>
        <span className="whitespace-nowrap text-sm font-semibold">{t("role.adminMode")}</span>
        <span id="role-switch-hint" className="sr-only">
          {t("role.switchHint")}
        </span>
        <button
          aria-checked={isAdminMode}
          aria-describedby="role-switch-hint role-switch-status"
          className="focus-visible:ring-ring border-line bg-surface-muted data-[checked=true]:bg-primary relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          data-checked={isAdminMode}
          disabled={switchingRole}
          onClick={() => void handleRoleSwitch()}
          role="switch"
          type="button"
        >
          <span className="sr-only">
            {switchingRole
              ? t("role.switching")
              : t(isAdminMode ? "role.turnAdminModeOff" : "role.turnAdminModeOn")}
          </span>
          <span
            aria-hidden="true"
            className="bg-surface shadow-soft h-6 w-6 rounded-full transition-transform data-[checked=true]:translate-x-6"
            data-checked={isAdminMode}
          />
        </button>
        <span className="text-ink-subtle min-w-8 text-xs font-semibold">
          {isAdminMode ? t("role.on") : t("role.off")}
        </span>
        <p id="role-switch-status" aria-live="polite" className="sr-only">
          {roleSwitchMessage}
        </p>
      </div>
    </aside>
  );
};
