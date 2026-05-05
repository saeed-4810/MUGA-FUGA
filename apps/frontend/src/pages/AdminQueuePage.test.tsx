/**
 * U-ADMIN-001..004 — AdminQueuePage states + actions.
 *
 * Covers:
 *   - U-ADMIN-001: loading skeleton (aria-busy)
 *   - U-ADMIN-002: empty inbox-zero card
 *   - U-ADMIN-003: list table renders name + artist + owner + created date + action buttons
 *   - U-ADMIN-003: error alert with API code + message
 *   - U-ADMIN-004a: approve action POSTs /products/:id/approve and reloads
 *   - U-ADMIN-004b: reject action prompts for reason and POSTs /products/:id/reject with reason
 *   - U-ADMIN-004c: reject with no reason (cancel) still POSTs (with empty body)
 *   - role guard: customer accessing /admin/queue sees the forbidden card
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const useAuthMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import { AdminQueuePage } from "./AdminQueuePage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/queue"]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login">login</div>} />
        <Route path="/admin/queue" element={<AdminQueuePage />} />
      </Routes>
    </MemoryRouter>
  );

const seedAuthAdmin = () =>
  useAuthMock.mockReturnValue({
    user: { uid: "uid-admin", email: "admin@example.com", role: "admin" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

const fixture = (overrides: Partial<{ id: string; name: string; artistName: string }> = {}) => ({
  id: overrides.id ?? "p1",
  name: overrides.name ?? "Pending Album",
  artistName: overrides.artistName ?? "Pending Artist",
  ownerEmail: "owner@example.com",
  createdAt: "2026-05-01T10:00:00Z",
  status: "pending" as const,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- spy retval shape varies
let promptSpy: any;

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  useAuthMock.mockReset();
  // window.prompt is jsdom-provided but we want to control its return value.
  promptSpy = vi.spyOn(window, "prompt").mockReturnValue("looks fake");
});

afterEach(() => {
  promptSpy.mockRestore();
});

describe("U-ADMIN-001..004: AdminQueuePage", () => {
  it("U-ADMIN-001 — loading state shows an aria-busy skeleton", () => {
    seedAuthAdmin();
    apiGetMock.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("U-ADMIN-002 — empty queue renders 'inbox zero' card", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValue({ items: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/inbox zero/i)).toBeInTheDocument());
    expect(screen.getByText(/nothing to review/i)).toBeInTheDocument();
  });

  it("U-ADMIN-003a — list renders columns and rows for each pending product", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValue({
      items: [fixture(), fixture({ id: "p2", name: "Other Album", artistName: "Other Artist" })],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Pending Album")).toBeInTheDocument());
    expect(screen.getByText("Pending Artist")).toBeInTheDocument();
    expect(screen.getByText("Other Album")).toBeInTheDocument();
    expect(screen.getAllByText("owner@example.com")).toHaveLength(2);
    // /api/products?status=pending was called (admins see only pending)
    expect(apiGetMock).toHaveBeenCalledWith("/products?status=pending");
    // Action buttons present per row
    expect(screen.getAllByRole("button", { name: /approve/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /reject/i })).toHaveLength(2);
  });

  it("U-ADMIN-003b — error alert renders with API code + message", async () => {
    seedAuthAdmin();
    apiGetMock.mockRejectedValue({
      status: 500,
      code: "INTERNAL",
      message: "boom",
      requestId: "r-1",
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*boom/i);
  });

  it("U-ADMIN-004a — approve POSTs /products/:id/approve and triggers a reload", async () => {
    seedAuthAdmin();
    // First load returns one row, second load (after approve) returns empty
    apiGetMock.mockResolvedValueOnce({ items: [fixture()] }).mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValueOnce({ id: "p1", status: "published" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Pending Album")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/products/p1/approve", {});
    // Reload triggered → list now empty
    await waitFor(() => expect(screen.getByText(/inbox zero/i)).toBeInTheDocument());
    expect(apiGetMock).toHaveBeenCalledTimes(2);
  });

  it("U-ADMIN-004b — reject prompts for a reason and POSTs with that reason", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValueOnce({ items: [fixture()] }).mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValueOnce({ id: "p1", status: "rejected" });
    promptSpy.mockReturnValueOnce("Cover art breaches guidelines");
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Pending Album")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /reject/i }));
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(apiPostMock).toHaveBeenCalledWith("/products/p1/reject", {
      reason: "Cover art breaches guidelines",
    });
  });

  it("U-ADMIN-004c — reject with no reason (prompt cancelled) still POSTs an empty body", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValueOnce({ items: [fixture()] }).mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValueOnce({ id: "p1", status: "rejected" });
    promptSpy.mockReturnValueOnce(null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Pending Album")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /reject/i }));
    // The component falls back to `{}` when the user dismisses the prompt
    expect(apiPostMock).toHaveBeenCalledWith("/products/p1/reject", {});
  });

  it("U-ADMIN-005 — customer hitting /admin/queue sees the role-mismatch forbidden card", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "uid-cust", email: "c@example.com", role: "customer" },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
    apiGetMock.mockReturnValue(new Promise(() => undefined));
    renderPage();
    // RequireAuth role="admin" surfaces the forbidden card; the queue table
    // never renders. The page component itself still mounts (React computes
    // the children before deciding what to render), so the fetch fires —
    // but the user only sees the alert, not the inbox-zero card.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/inbox zero/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reject/i })).toBeNull();
  });
});
