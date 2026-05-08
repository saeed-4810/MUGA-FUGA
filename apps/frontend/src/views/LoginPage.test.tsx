import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ThemeProvider } from "../context/ThemeContext";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const isConfiguredMock = vi.fn();
vi.mock("../lib/firebase", () => ({
  isFirebaseConfigured: () => isConfiguredMock(),
}));

const replaceWithMock = vi.fn();
vi.mock("../lib/navigation", () => ({
  replaceWith: (...args: unknown[]) => replaceWithMock(...args),
}));

import { LoginPage } from "./LoginPage";

const renderAt = (path: string) => {
  window.history.pushState({}, "", path);
  return render(
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>
  );
};

beforeEach(() => {
  isConfiguredMock.mockReturnValue(true);
  replaceWithMock.mockReset();
});

describe("LoginPage", () => {
  it("U-AUTH-001a — when nobody's signed in we render the brand, locale switcher, theme toggle, and the Google sign-in CTA", () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(screen.getAllByRole("img", { name: /fuga/i }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("U-AUTH-001b — clicking 'Sign in with Google' calls the signIn() handler from AuthContext", async () => {
    const signIn = vi.fn();
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn,
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    renderAt("/login");
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("U-AUTH-001c — if Saeed is already signed in but somehow lands on /login, we redirect him to / and don't render the CTA", async () => {
    useAuthMock.mockReturnValue({
      user: { uid: "usr_saeed_h", email: "saeedh582@gmail.com", role: "customer" },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(replaceWithMock).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("button", { name: /sign in with google/i })).toBeNull();
  });

  it("U-AUTH-001d — when Firebase isn't configured (e.g. CI preview build), show the 'sign-in unavailable' banner + disabled button", () => {
    isConfiguredMock.mockReturnValue(false);
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeDisabled();
  });

  it("U-AUTH-001e — while AuthContext is still loading, the sign-in button is disabled (no double-click)", () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeDisabled();
  });

  it("U-AUTH-001f — if the popup gets blocked, show a friendly 'sign-in failed' alert (don't leak the raw error)", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn().mockRejectedValue(new Error("popup blocked")),
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    renderAt("/login");
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/sign-in failed/i);
  });

  it("U-AUTH-001g — while sign-in is in flight: button text becomes 'Signing in…' + 'preparing your secure session' status", async () => {
    let resolveSignIn: (() => void) | undefined;
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(() => new Promise<void>((resolve) => (resolveSignIn = resolve))),
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    renderAt("/login");
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/preparing your secure session/i);
    resolveSignIn?.();
  });
});
