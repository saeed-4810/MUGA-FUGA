import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

const apiGetMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({
  api: { get: apiGetMock },
}));

vi.mock("@/components/LocaleSwitcher", () => ({
  LocaleSwitcher: () => <button data-testid="locale-switcher">locale</button>,
}));
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">theme</button>,
}));
vi.mock("@/components/UserMenu", () => ({
  UserMenu: () => <button>user menu</button>,
}));

import { AppShell } from "./AppShell";

const renderShell = (children: ReactNode = <div>content</div>) =>
  render(<AppShell initialPendingReviewCount={3}>{children}</AppShell>);

beforeEach(() => {
  pathnameMock.mockReturnValue("/admin/queue");
  useAuthMock.mockReset();
  apiGetMock.mockReset();
  apiGetMock.mockImplementation((path: string) =>
    Promise.resolve({
      items: path.includes("products") ? [{ id: "p1" }, { id: "p2" }] : [{ id: "a1" }],
    })
  );
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

  it("U-ROLE-SWITCH-001b — signed-in shell renders the centered bottom role toggle", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u2", email: "customer@example.com", role: "customer" },
      loading: false,
      switchingRole: false,
      switchRole: vi.fn(),
    });
    renderShell();

    expect(screen.getByText(/^admin mode$/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /turn admin mode on/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
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

  it("U-APP-SHELL-004b — mobile drawer closes from the backdrop and nav links", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "u1", email: "admin@example.com", role: "admin" } });
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    await user.click(screen.getByRole("button", { name: /close navigation backdrop/i }));
    expect(screen.getAllByRole("link", { name: /products/i })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /open navigation/i }));
    const mobileProductsLink = screen.getAllByRole("link", { name: /products/i }).at(1);
    expect(mobileProductsLink).toBeDefined();
    await user.click(mobileProductsLink as HTMLElement);
    expect(screen.getAllByRole("link", { name: /products/i })).toHaveLength(1);
  });

  it("U-APP-SHELL-005 — admin pending review polling refreshes the badge", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "u1", email: "admin@example.com", role: "admin" } });
    apiGetMock
      .mockResolvedValueOnce({ items: [{ id: "p1" }, { id: "p2" }] })
      .mockResolvedValueOnce({ items: [{ id: "a1" }] });
    render(<AppShell initialPendingReviewCount={1}>content</AppShell>);

    await waitFor(() => expect(screen.getByLabelText(/3 pending review/i)).toBeInTheDocument());
    expect(apiGetMock).toHaveBeenCalledWith("/products?status=pending");
    expect(apiGetMock).toHaveBeenCalledWith("/artists?status=pending");
  });

  it("U-APP-SHELL-006 — admin pending review polling keeps the server count after refresh failure", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "u1", email: "admin@example.com", role: "admin" } });
    apiGetMock.mockRejectedValue(new Error("offline"));
    render(<AppShell initialPendingReviewCount={4}>content</AppShell>);

    await waitFor(() => expect(screen.getByLabelText(/4 pending review/i)).toBeInTheDocument());
  });
});
