/**
 * U-APP-SHELL-001..004 — shell nav + pending review badge.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => useAuthMock(),
}));

vi.mock("../context/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const apiGetMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
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

import { AppShell, AuthLayout } from "./AppShell";

const renderShell = (initialPath = "/admin/queue") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<div>home</div>} />
          <Route path="products" element={<div>products</div>} />
          <Route path="products/new" element={<div>new product</div>} />
          <Route path="admin/queue" element={<div>queue</div>} />
          <Route path="admin/artists" element={<div>artists</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const renderAuthLayout = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<AuthLayout />}>
          <Route index element={<div data-testid="login-overlay">login</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  apiGetMock.mockReset();
  useAuthMock.mockReset();
});

describe("U-APP-SHELL-001..004: AppShell", () => {
  it("U-APP-SHELL-001 — admin sees artists nav and combined pending badge", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "a", email: "a@example.com", role: "admin" } });
    apiGetMock
      .mockResolvedValueOnce({ items: [{ id: "p1" }, { id: "p2" }] })
      .mockResolvedValueOnce({ items: [{ id: "a1" }] });
    const { unmount } = renderShell();
    expect(screen.getByRole("link", { name: /artists/i })).toHaveAttribute(
      "href",
      "/admin/artists"
    );
    await waitFor(() => expect(screen.getByLabelText(/3 pending review/i)).toBeInTheDocument());
    expect(apiGetMock).toHaveBeenCalledWith("/products?status=pending");
    expect(apiGetMock).toHaveBeenCalledWith("/artists?status=pending");
    unmount();
  });

  it("U-APP-SHELL-002 — pending badge refresh failure falls back to no badge", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "a", email: "a@example.com", role: "admin" } });
    apiGetMock.mockRejectedValue(new Error("offline"));
    renderShell();
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText(/pending review/i)).toBeNull();
  });

  it("U-APP-SHELL-003 — customer does not see admin-only nav or trigger pending calls", () => {
    useAuthMock.mockReturnValue({ user: { uid: "c", email: "c@example.com", role: "customer" } });
    renderShell("/");
    expect(screen.queryByRole("link", { name: /artists/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approval queue/i })).toBeNull();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("U-APP-SHELL-004 — topbar reports the current path", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderShell("/admin/artists");
    expect(screen.getByText("/admin/artists")).toBeInTheDocument();
    expect(screen.getAllByAltText("FUGA").length).toBeGreaterThan(0);
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("U-APP-SHELL-004b — nests create product under products in primary nav", () => {
    useAuthMock.mockReturnValue({ user: { uid: "c", email: "c@example.com", role: "customer" } });
    renderShell("/products/new");
    const productsGroup = screen.getByRole("group", { name: /products/i });
    expect(productsGroup).toContainElement(screen.getByRole("link", { name: /^products$/i }));
    expect(productsGroup).toContainElement(screen.getByRole("link", { name: /create product/i }));
  });

  it("U-APP-SHELL-005 — AuthLayout renders the outlet without sidebar, topbar, or pending poll", () => {
    useAuthMock.mockReturnValue({ user: null });
    renderAuthLayout();
    // Login overlay child is rendered inside the auth layout
    expect(screen.getByTestId("login-overlay")).toBeInTheDocument();
    // Chrome is NOT in the React tree on /login (JS-level isolation, not CSS)
    expect(screen.queryByRole("link", { name: /artists/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /approval queue/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /products/i })).toBeNull();
    expect(screen.queryByTestId("locale-switcher")).toBeNull();
    expect(screen.queryByTestId("theme-toggle")).toBeNull();
    // Pending-review API must not be called pre-auth
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("U-APP-SHELL-006 — mobile menu opens and closes the navigation drawer", async () => {
    useAuthMock.mockReturnValue({ user: { uid: "c", email: "c@example.com", role: "customer" } });
    const user = userEvent.setup();
    renderShell("/");

    expect(screen.queryByRole("dialog", { name: /mobile navigation/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
    expect(screen.getByRole("dialog", { name: /mobile navigation/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close navigation menu/i }));
    expect(screen.queryByRole("dialog", { name: /mobile navigation/i })).toBeNull();
  });
});
