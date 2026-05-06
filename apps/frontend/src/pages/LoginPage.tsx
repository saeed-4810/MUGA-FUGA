import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { PageSurface, StatusBanner } from "../components/Composition";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../lib/firebase";

export const LoginPage = () => {
  const { t } = useTranslation("auth");
  const { user, signIn, loading } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const firebaseReady = isFirebaseConfigured();
  const ctaDisabled = loading || submitting || !firebaseReady;
  const handleSignIn = async () => {
    setSignInError(null);
    setSubmitting(true);
    try {
      await signIn();
    } catch {
      setSignInError(t("login.errors.signInFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageSurface className="grid min-h-[calc(100vh-8rem)] place-items-center">
      {/*
        Pre-auth chrome: brand mark + locale + theme controls. Unauthenticated
        users still get i18n + dark mode. Also covers E-SHELL-001 (landing
        renders MUGA, theme toggle, locale switcher without requiring auth).
      */}
      <div
        className="border-border bg-card shadow-soft grid w-full max-w-5xl overflow-hidden rounded-3xl border lg:grid-cols-[1.05fr_0.95fr]"
        data-testid="login-shell"
      >
        <div className="bg-primary text-primary-foreground relative hidden overflow-hidden p-10 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.24),transparent_40%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="space-y-8">
              <h1 className="m-0">
                <img
                  alt={t("login.heroTitle")}
                  className="h-12 w-auto"
                  data-testid="fuga-logo"
                  src="/fuga-logo.svg"
                />
              </h1>
              <div className="space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.24em] opacity-80">
                  {t("login.eyebrow")}
                </p>
                <p className="max-w-md text-sm leading-7 opacity-85">{t("login.heroBody")}</p>
              </div>
            </div>
            <ul className="grid gap-3 text-sm opacity-90" aria-label={t("login.benefitsLabel")}>
              {["approval", "catalog", "theme"].map((key) => (
                <li className="flex items-center gap-3" key={key}>
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/15"
                  >
                    ✓
                  </span>
                  <span>{t(`login.benefits.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-5 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="text-2xl font-bold tracking-tight lg:hidden">MUGA</div>
            <div className="ml-auto flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0">
              <p className="text-primary text-sm font-medium uppercase tracking-[0.2em]">
                {t("login.eyebrow")}
              </p>
              <CardTitle>{t("login.title")}</CardTitle>
              <CardDescription className="leading-6">{t("login.body")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-0 pb-0">
              {!firebaseReady && (
                <StatusBanner tone="warning">{t("login.unconfigured")}</StatusBanner>
              )}
              {signInError && (
                <StatusBanner role="alert" tone="danger">
                  {signInError}
                </StatusBanner>
              )}
              <Button
                aria-busy={submitting || loading}
                aria-disabled={ctaDisabled}
                aria-label={submitting ? t("login.submitting") : t("actions.signInWithGoogle")}
                className="h-12 w-full rounded-xl"
                disabled={ctaDisabled}
                onClick={() => void handleSignIn()}
                type="button"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    {t("login.submitting")}
                  </span>
                ) : (
                  t("actions.signInWithGoogle")
                )}
              </Button>
              {submitting && (
                <p
                  aria-live="polite"
                  className="text-muted-foreground text-center text-xs leading-5"
                  role="status"
                >
                  {t("login.submittingDescription")}
                </p>
              )}
              <p className="text-muted-foreground text-center text-xs leading-5">
                {t("login.securityNote")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageSurface>
  );
};
