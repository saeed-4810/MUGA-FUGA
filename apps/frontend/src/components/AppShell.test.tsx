/**
 * U-APP-SHELL-001..004 — shell nav + pending review badge.
 */
import { render, screen, waitFor } from "@testing-library/react";
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

import { AppShell } from "./AppShell";

const renderShell = (initialPath = "/admin/queue") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<div>home</div>} />
          <Route path="admin/queue" element={<div>queue</div>} />
          <Route path="admin/artists" element={<div>artists</div>} />
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
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });
});
