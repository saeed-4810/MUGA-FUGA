import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("@/lib/api", () => ({
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

const renderPage = () => {
  window.history.pushState({}, "", "/admin/queue");
  return render(<AdminQueuePage />);
};

const renderServerPage = (props: React.ComponentProps<typeof AdminQueuePage>) => {
  window.history.pushState({}, "", "/admin/queue");
  return render(<AdminQueuePage {...props} />);
};

const seedAuthAdmin = () =>
  useAuthMock.mockReturnValue({
    user: { uid: "usr_marcus_admin", email: "marcus@muga.app", role: "admin" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

const fixture = (overrides: Partial<{ id: string; name: string; artistName: string }> = {}) => ({
  id: overrides.id ?? "prod_midnights",
  name: overrides.name ?? "Midnights",
  artist: {
    id: `${overrides.id ?? "prod_midnights"}-artist`,
    name: overrides.artistName ?? "Taylor Swift",
    status: "published" as const,
  },
  ownerEmail: "saeedh582@gmail.com",
  createdAt: "2026-05-01T10:00:00Z",
  status: "pending" as const,
});

let promptSpy: { mockRestore: () => void };

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  useAuthMock.mockReset();
  promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Cover art looks AI-generated");
});

afterEach(() => {
  promptSpy.mockRestore();
});

describe("Admin approval queue page", () => {
  it("U-ADMIN-001 — initial render shows an aria-busy skeleton while the queue is being fetched", () => {
    seedAuthAdmin();
    apiGetMock.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("U-ADMIN-002 — empty queue renders 'inbox zero' card", async () => {
    seedAuthAdmin();
    renderServerPage({ initialItems: [] });
    expect(screen.getByText(/inbox zero/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing to review/i)).toBeInTheDocument();
  });

  it("U-ADMIN-003a — list renders columns and rows for each pending product", () => {
    seedAuthAdmin();
    renderServerPage({
      initialItems: [
        fixture(),
        fixture({ id: "prod_renaissance", name: "Renaissance", artistName: "Beyoncé" }),
      ],
    });
    expect(screen.getByText("Midnights")).toBeInTheDocument();
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
    expect(screen.getByText("Renaissance")).toBeInTheDocument();
    expect(screen.getAllByText("saeedh582@gmail.com")).toHaveLength(2);
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /^approve$/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^reject$/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /details/i })).toHaveLength(2);
  });

  it("U-ADMIN-003b — error alert renders with API code + message", () => {
    seedAuthAdmin();
    renderServerPage({
      initialError: { status: 500, code: "INTERNAL", message: "boom", requestId: "rid_inv_001" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*boom/i);
  });

  it("U-ADMIN-004a — approve POSTs /products/:id/approve and triggers a reload", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValueOnce({ id: "prod_midnights", status: "published" });
    const user = userEvent.setup();
    renderServerPage({ initialItems: [fixture()] });
    expect(screen.getByText("Midnights")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/products/prod_midnights/approve", {});
    await waitFor(() => expect(screen.getByText(/inbox zero/i)).toBeInTheDocument());
    expect(apiGetMock).toHaveBeenCalledTimes(1);
  });

  it("U-ADMIN-004a2 — approve failure renders the API error", async () => {
    seedAuthAdmin();
    apiPostMock.mockRejectedValueOnce({
      status: 500,
      code: "INTERNAL",
      message: "approve failed",
      requestId: "rid_inv_001",
    });
    const user = userEvent.setup();
    renderServerPage({ initialItems: [fixture()] });
    await user.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*approve failed/i)
    );
  });

  it("U-ADMIN-004b — reject prompts for a reason and POSTs with that reason", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValueOnce({ id: "prod_midnights", status: "rejected" });
    const user = userEvent.setup();
    renderServerPage({ initialItems: [fixture()] });
    expect(screen.getByText("Midnights")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/reason/i), "Cover art breaches guidelines");
    await user.click(screen.getByRole("button", { name: /reject product/i }));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(apiPostMock).toHaveBeenCalledWith("/products/prod_midnights/reject", {
      reason: "Cover art breaches guidelines",
    });
  });

  it("U-ADMIN-004b2 — reject failure keeps the dialog path safe and renders the API error", async () => {
    seedAuthAdmin();
    apiPostMock.mockRejectedValueOnce({
      status: 500,
      code: "INTERNAL",
      message: "reject failed",
      requestId: "rid_inv_001",
    });
    const user = userEvent.setup();
    renderServerPage({ initialItems: [fixture()] });
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.click(screen.getByRole("button", { name: /reject product/i }));
    await waitFor(() =>
      expect(document.querySelector('[role="alert"]')).toHaveTextContent(/INTERNAL.*reject failed/i)
    );
  });

  it("U-ADMIN-004c — reject with no reason still POSTs an empty body", async () => {
    seedAuthAdmin();
    apiGetMock.mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValueOnce({ id: "prod_midnights", status: "rejected" });
    const user = userEvent.setup();
    renderServerPage({ initialItems: [fixture()] });
    expect(screen.getByText("Midnights")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.click(screen.getByRole("button", { name: /reject product/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/products/prod_midnights/reject", {});
  });

  it("U-ADMIN-004d — details and reject dialogs can be opened and dismissed", async () => {
    seedAuthAdmin();
    const user = userEvent.setup();
    renderServerPage({ initialItems: [fixture()] });

    await user.click(screen.getByRole("button", { name: /details/i }));
    expect(screen.getByRole("dialog", { name: /submission details/i })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /^close$/i })[0]!);

    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    expect(screen.getByRole("dialog", { name: /reject midnights/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /reject midnights/i })).toBeNull();
  });
});
