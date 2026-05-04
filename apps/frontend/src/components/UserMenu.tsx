import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";

export const UserMenu = () => {
  const { t } = useTranslation("auth");
  const { user, signIn, signOut, loading } = useAuth();

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

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-tight">{user.displayName ?? user.email}</div>
        <div className="text-ink-subtle text-xs">
          {t("role.label")}: {t(`role.${user.role}`)}
        </div>
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
      <button type="button" className="btn-ghost h-9" onClick={() => void signOut()}>
        {t("actions.signOut")}
      </button>
    </div>
  );
};
