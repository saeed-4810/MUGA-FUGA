/**
 * U-AUTH-003 — RequireAuth guard component.
 *
 * Covers:
 *   - loading → busy spinner with i18n label
 *   - unauthenticated → redirect to /login
 *   - authenticated, no role required → render children
 *   - authenticated, role mismatch → forbidden card (admin-only path)
 *   - authenticated, matching role → render children
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import { RequireAuth } from "./RequireAuth";

const renderAt = (path: string, ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-screen">login</div>} />
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>
  );

describe("U-AUTH-003: RequireAuth guard", () => {
  it("U-AUTH-003a — loading state renders the loading region", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    renderAt(
      "/products",
      <RequireAuth>
        <div data-testid="protected">secret</div>
      </RequireAuth>
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("U-AUTH-003b — unauthenticated user is redirected to /login", () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderAt(
      "/products",
      <RequireAuth>
        <div data-testid="protected">secret</div>
      </RequireAuth>
    );
    expect(screen.getByTestId("login-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("U-AUTH-003c — authenticated customer can access non-role-restricted page", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u1", email: "c@example.com", role: "customer" },
      loading: false,
    });
    renderAt(
      "/products",
      <RequireAuth>
        <div data-testid="protected">secret</div>
      </RequireAuth>
    );
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("U-AUTH-003d — customer hitting admin-only route sees forbidden card", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u1", email: "c@example.com", role: "customer" },
      loading: false,
    });
    renderAt(
      "/admin/queue",
      <RequireAuth role="admin">
        <div data-testid="protected">queue</div>
      </RequireAuth>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/don.?t have access/i)).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).toBeNull();
  });

  it("U-AUTH-003e — admin can access an admin-only route", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u-admin", email: "a@example.com", role: "admin" },
      loading: false,
    });
    renderAt(
      "/admin/queue",
      <RequireAuth role="admin">
        <div data-testid="protected">queue</div>
      </RequireAuth>
    );
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });
});
