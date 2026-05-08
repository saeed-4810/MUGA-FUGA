import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("./LocaleSwitcher", () => ({
  LocaleSwitcher: () => <button data-testid="locale-switcher">locale</button>,
}));
vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">theme</button>,
}));
vi.mock("./UserMenu", () => ({
  UserMenu: () => <button>user menu</button>,
}));

import { AppShell } from "./AppShell";

const renderShell = (children: ReactNode = <div>content</div>) =>
  render(<AppShell initialPendingReviewCount={3}>{children}</AppShell>);

beforeEach(() => {
  pathnameMock.mockReturnValue("/admin/queue");
  useAuthMock.mockReset();
});

describe("U-APP-SHELL-001..004: AppShell", () => {
  it("U-APP-SHELL-001 — admin sees admin nav and pending badge", () => {
    useAuthMock.mockReturnValue({ user: { uid: "u1", email: "admin@example.com", role: "admin" } });
    renderShell();
    expect(screen.getByRole("link", { name: /artists/i })).toHaveAttribute(
      "href",
      "/admin/artists"
    );
    expect(screen.getByLabelText(/3 pending review/i)).toBeInTheDocument();
  });

  it("U-APP-SHELL-001b — admin pending badge is hidden when the count is zero", () => {
    useAuthMock.mockReturnValue({ user: { uid: "u1", email: "admin@example.com", role: "admin" } });
    render(<AppShell initialPendingReviewCount={0}>content</AppShell>);
    expect(screen.queryByLabelText(/pending review/i)).toBeNull();
  });

  it("U-APP-SHELL-002 — customer does not see admin nav", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u2", email: "customer@example.com", role: "customer" },
    });
    renderShell();
    expect(screen.queryByRole("link", { name: /artists/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approval queue/i })).toBeNull();
  });

  it("U-APP-SHELL-003 — topbar reports the current path and actions", () => {
    pathnameMock.mockReturnValue("/products");
    useAuthMock.mockReturnValue({ user: null });
    renderShell();
    expect(screen.getByText("/products")).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("U-APP-SHELL-004 — mobile drawer can open and close", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "u1", email: "admin@example.com", role: "admin" } });
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(screen.getAllByRole("link", { name: /products/i }).length).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: /close navigation menu/i }));
    expect(screen.getAllByRole("link", { name: /products/i })).toHaveLength(1);
  });
});
