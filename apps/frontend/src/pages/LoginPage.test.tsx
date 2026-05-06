/**
 * U-AUTH-001 — LoginPage component.
 *
 * Covers:
 *   - unauthenticated user sees brand mark, locale switcher, theme toggle, sign-in CTA
 *   - "Sign in with Google" click triggers signIn
 *   - already-authenticated user is redirected to /
 *   - "firebase not configured" build (preview / no env) shows banner + disables CTA
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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

import { LoginPage } from "./LoginPage";

const renderAt = (path: string) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<div data-testid="dashboard">dashboard</div>} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

beforeEach(() => {
  isConfiguredMock.mockReturnValue(true);
});

describe("U-AUTH-001: LoginPage", () => {
  it("U-AUTH-001a — unauthenticated renders brand, locale switcher, theme toggle, sign-in CTA", () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(screen.getAllByText("MUGA", { selector: "div" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: /sign in to muga/i })).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("U-AUTH-001b — sign-in click triggers signIn()", async () => {
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

  it("U-AUTH-001b2 — sign-in failure surfaces retryable error alert", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error("popup closed"));
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn,
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    renderAt("/login");
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/sign-in failed.*try again/i);
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("U-AUTH-001b3 — non-error sign-in rejection uses safe fallback copy", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn().mockRejectedValue("cancelled"),
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    renderAt("/login");
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/sign-in failed.*try again/i);
  });

  it("U-AUTH-001c — authenticated user lands on /login → redirected to /", async () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u1", email: "c@example.com", role: "customer" },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });

  it("U-AUTH-001d — when firebase is not configured, banner + disabled button", () => {
    isConfiguredMock.mockReturnValue(false);
    useAuthMock.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    // Banner visible (role=status from the LoginPage markup)
    expect(screen.getByRole("status")).toBeInTheDocument();
    // CTA disabled
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeDisabled();
  });

  it("U-AUTH-001e — loading state disables the button", () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    renderAt("/login");
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeDisabled();
  });
});
