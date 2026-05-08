import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Role, useAuth } from "../context/AuthContext";
import { replaceWith } from "../lib/navigation";

const getOppositeRole = (role: Role): Role => (role === "admin" ? "customer" : "admin");

export const UserMenu = () => {
  const { t } = useTranslation("auth");
  const { user, signIn, signOut, loading, switchingRole, switchRole } = useAuth();
  const [roleSwitchMessage, setRoleSwitchMessage] = useState("");

  const handleSignOut = async () => {
    await signOut();
    replaceWith("/login");
  };

  const handleRoleSwitch = async (role: Role) => {
    setRoleSwitchMessage("");
    try {
      await switchRole(role);
      setRoleSwitchMessage(t("role.switchSuccess"));
    } catch {
      setRoleSwitchMessage(t("role.switchError"));
    }
  };

  if (loading) {
    return (
      <div
        className="bg-surface-muted h-9 w-24 animate-pulse rounded-xl"
        aria-busy="true"
        aria-label={t("status.loading")}
      />
    );
  }

  if (!user) {
    return (
      <button type="button" className="btn-primary h-9" onClick={() => void signIn()}>
        {t("actions.signInWithGoogle")}
      </button>
    );
  }

  const nextRole = getOppositeRole(user.role);

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
      <div className="border-line bg-surface/80 hidden rounded-2xl border px-3 py-2 text-right shadow-sm sm:block">
        <div className="text-sm font-medium leading-tight">{user.displayName ?? user.email}</div>
        <div className="text-ink-subtle text-xs">
          {t("role.label")}: {t(`role.${user.role}`)}
        </div>
      </div>
      <div className="border-warning/30 bg-warning/10 text-ink flex max-w-[18rem] flex-col rounded-2xl border px-3 py-2 text-xs dark:border-amber-300/30 dark:bg-amber-300/10">
        <span className="font-semibold">{t("role.switchLabel")}</span>
        <span className="text-ink-subtle">{t("role.switchHint")}</span>
        <button
          aria-describedby="role-switch-hint role-switch-status"
          className="btn-ghost mt-2 h-9 justify-center text-xs"
          disabled={switchingRole}
          onClick={() => void handleRoleSwitch(nextRole)}
          type="button"
        >
          {switchingRole
            ? t("role.switching")
            : t(nextRole === "admin" ? "role.switchToAdmin" : "role.switchToCustomer")}
        </button>
        <span id="role-switch-hint" className="sr-only">
          {t("role.switchHint")}
        </span>
        <span id="role-switch-status" aria-live="polite" className="text-ink-subtle mt-1 min-h-4">
          {roleSwitchMessage}
        </span>
      </div>
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt=""
          className="border-line h-9 w-9 rounded-full border"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="border-line bg-surface-muted grid h-9 w-9 place-items-center rounded-full border text-sm">
          {user.email[0]?.toUpperCase()}
        </div>
      )}
      <button type="button" className="btn-ghost h-9" onClick={() => void handleSignOut()}>
        {t("actions.signOut")}
      </button>
    </div>
  );
};
