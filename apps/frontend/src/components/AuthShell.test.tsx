import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock("../context/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

import { AuthShell } from "./AuthShell";

describe("AuthShell", () => {
  it("wraps standalone auth pages with theme and auth providers", () => {
    render(
      <AuthShell
        initialUser={{ uid: "usr_saeed_h", email: "saeedh582@gmail.com", role: "customer" }}
      >
        <main>Login only</main>
      </AuthShell>
    );

    expect(screen.getByTestId("theme-provider")).toContainElement(
      screen.getByTestId("auth-provider")
    );
    expect(screen.getByText("Login only")).toBeInTheDocument();
  });
});
