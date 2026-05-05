/**
 * U-ARTIST-001..010 — Admin artists workspace.
 *
 * Covers list loading/empty/error/success, status filtering, create/edit,
 * signed image upload, delete success, delete FK-block, and inline moderation.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
}));

const useAuthMock = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import { ArtistsPage } from "./ArtistsPage";

type ArtistStatus = "pending" | "published" | "rejected";

interface ArtistOverrides {
  id?: string;
  name?: string;
  status?: ArtistStatus;
  imageUrl?: string;
  country?: string | null;
  bio?: string;
  imageObjectPath?: string;
}

const artist = (overrides: ArtistOverrides = {}) => ({
  id: overrides.id ?? "a1",
  name: overrides.name ?? "Aurora",
  ...(overrides.bio !== undefined ? { bio: overrides.bio } : {}),
  ...(overrides.country === null ? {} : { country: overrides.country ?? "NO" }),
  ...(overrides.imageUrl !== undefined ? { imageUrl: overrides.imageUrl } : {}),
  ...(overrides.imageObjectPath !== undefined
    ? { imageObjectPath: overrides.imageObjectPath }
    : {}),
  status: overrides.status ?? "published",
  ownerEmail: "owner@example.com",
  createdAt: "2026-05-05T10:00:00Z",
});

const seedAdmin = () =>
  useAuthMock.mockReturnValue({
    user: { uid: "admin-1", email: "admin@example.com", role: "admin" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

const seedCustomer = () =>
  useAuthMock.mockReturnValue({
    user: { uid: "customer-1", email: "customer@example.com", role: "customer" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/artists"]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login">login</div>} />
        <Route path="/admin/artists" element={<ArtistsPage />} />
      </Routes>
    </MemoryRouter>
  );

const fetchMock = vi.fn();
let promptSpy: { mockRestore: () => void };

beforeEach(() => {
  seedAdmin();
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiPatchMock.mockReset();
  apiDeleteMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:preview") });
  promptSpy = vi.spyOn(window, "prompt").mockReturnValue("not ready");
});

afterEach(() => {
  promptSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe("U-ARTIST-001..010: ArtistsPage", () => {
  it("U-ARTIST-001 — loading state shows an aria-busy skeleton", () => {
    apiGetMock.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(apiGetMock).toHaveBeenCalledWith("/artists?status=published");
  });

  it("U-ARTIST-002 — empty states change with the status filter", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText(/no published artists yet/i)).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() => expect(apiGetMock).toHaveBeenLastCalledWith("/artists?status=pending"));
    expect(screen.getByText(/no artists pending review/i)).toBeInTheDocument();
  });

  it("U-ARTIST-003 — API errors render a user-safe alert", async () => {
    apiGetMock.mockRejectedValue({
      status: 500,
      code: "INTERNAL",
      message: "boom",
      requestId: "r1",
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*boom/i));
  });

  it("U-ARTIST-004 — list renders image, fallback thumb, metadata, status pill, and actions", async () => {
    apiGetMock.mockResolvedValue({
      items: [
        artist({ imageUrl: "https://cdn.example.test/a.jpg" }),
        artist({ id: "a2", name: "Bicep", country: null }),
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Aurora")).toBeInTheDocument());
    expect(screen.getByAltText(/cover image for aurora/i)).toBeInTheDocument();
    expect(screen.getByText("Bicep")).toBeInTheDocument();
    expect(screen.getAllByText("Published")).toHaveLength(3);
    expect(screen.getAllByText("owner@example.com")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /edit aurora/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete aurora/i })).toBeInTheDocument();
  });

  it("U-ARTIST-005 — pending artists can be approved and rejected inline", async () => {
    apiGetMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artist({ status: "pending" })] })
      .mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /approve aurora/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /approve aurora/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists/a1/approve", {});
    apiGetMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artist({ status: "pending" })] })
      .mockResolvedValueOnce({ items: [] });
    await user.selectOptions(screen.getByLabelText(/status/i), "published");
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reject aurora/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /reject aurora/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists/a1/reject", { reason: "not ready" });
  });

  it("U-ARTIST-005b — rejected status filter renders rejected status pills", async () => {
    apiGetMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artist({ status: "rejected" })] });
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/status/i), "rejected");
    await waitFor(() => expect(screen.getByText("Aurora")).toBeInTheDocument());
    expect(screen.getAllByText("Rejected")).toHaveLength(2);
  });

  it("U-ARTIST-005c — rejecting with cancelled prompt posts an empty body", async () => {
    apiGetMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artist({ status: "pending" })] })
      .mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValue({});
    vi.spyOn(window, "prompt").mockReturnValueOnce(null);
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reject aurora/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /reject aurora/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists/a1/reject", {});
  });

  it("U-ARTIST-006 — create drawer posts a trimmed artist payload", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "  Froukje  ");
    await user.type(screen.getByLabelText(/^bio$/i), "  Dutch pop  ");
    await user.type(screen.getByLabelText(/^country$/i), "nl");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists", {
      name: "Froukje",
      bio: "Dutch pop",
      country: "NL",
    });
  });

  it("U-ARTIST-007 — image upload requests an artist signed URL and stores the object path", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock
      .mockResolvedValueOnce({
        uploadUrl: "https://upload.example.test",
        objectPath: "artist-images/u/1",
        expiresAt: "2026-05-05T11:00:00Z",
      })
      .mockResolvedValueOnce({});
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "S10");
    const file = new File(["x"], "artist.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/image/i), file);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://upload.example.test",
        expect.objectContaining({ method: "PUT", body: file })
      )
    );
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    expect(apiPostMock).toHaveBeenLastCalledWith("/artists", {
      name: "S10",
      imageObjectPath: "artist-images/u/1",
    });
  });

  it("U-ARTIST-007b — image upload PUT failure renders an upload error", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockResolvedValueOnce({
      uploadUrl: "https://upload.example.test",
      objectPath: "artist-images/u/1",
      expiresAt: "2026-05-05T11:00:00Z",
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.upload(
      screen.getByLabelText(/image/i),
      new File(["x"], "artist.png", { type: "image/png" })
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/image upload failed.*403/i)
    );
  });

  it("U-ARTIST-007c — signed-upload request failures render a fallback upload error", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce("network down");
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.upload(
      screen.getByLabelText(/image/i),
      new File(["x"], "artist.png", { type: "image/png" })
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/image upload failed/i)
    );
  });

  it("U-ARTIST-007c2 — empty image selection does not request an upload", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    fireEvent.change(screen.getByLabelText(/image/i), { target: { files: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("U-ARTIST-007d — editor Escape and Shift+Tab keyboard handling close/trap focus", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    const close = screen.getByRole("button", { name: /close/i });
    expect(close).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: /save artist/i })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /create artist/i })).toBeNull();
  });

  it("U-ARTIST-007e — create submit API errors render inside the editor", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce({
      status: 409,
      code: "CONFLICT",
      message: "duplicate",
      requestId: "r1",
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Aurora");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/CONFLICT.*duplicate/i)
    );
  });

  it("U-ARTIST-007f — create submit plain errors render inside the editor", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce(new Error("plain failure"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Aurora");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/plain failure/i));
  });

  it("U-ARTIST-008 — edit drawer patches existing artist details", async () => {
    apiGetMock.mockResolvedValue({
      items: [artist({ bio: "old", imageObjectPath: "artist-images/u/old" })],
    });
    apiPatchMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /edit aurora/i }));
    await user.clear(screen.getByLabelText(/^bio$/i));
    await user.type(screen.getByLabelText(/^bio$/i), "Updated bio");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    expect(apiPatchMock).toHaveBeenCalledWith("/artists/a1", {
      name: "Aurora",
      bio: "Updated bio",
      country: "NO",
      imageObjectPath: "artist-images/u/old",
    });
  });

  it("U-ARTIST-009 — delete confirms, calls API, and reloads", async () => {
    apiGetMock.mockResolvedValueOnce({ items: [artist()] }).mockResolvedValueOnce({ items: [] });
    apiDeleteMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /delete aurora/i }));
    expect(screen.getByRole("dialog", { name: /delete artist/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    expect(apiDeleteMock).toHaveBeenCalledWith("/artists/a1");
    await waitFor(() => expect(screen.getByText(/no published artists yet/i)).toBeInTheDocument());
  });

  it("U-ARTIST-009b — delete dialog can be cancelled and closed with Escape", async () => {
    apiGetMock.mockResolvedValue({ items: [artist()] });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /delete aurora/i }));
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: /delete artist/i })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /delete artist/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /delete aurora/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /delete artist/i })).toBeNull();
  });

  it("U-ARTIST-009c — non-conflict delete errors surface as a page alert", async () => {
    apiGetMock.mockResolvedValue({ items: [artist()] });
    apiDeleteMock.mockRejectedValue({
      status: 500,
      code: "INTERNAL",
      message: "boom",
      requestId: "r1",
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /delete aurora/i }));
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*boom/i));
  });

  it("U-ARTIST-009d — malformed delete 409 details surface as a page alert", async () => {
    apiGetMock.mockResolvedValue({ items: [artist()] });
    apiDeleteMock.mockRejectedValue({
      status: 409,
      code: "CONFLICT",
      message: "Artist has products attached",
      requestId: "r1",
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /delete aurora/i }));
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/CONFLICT.*products attached/i)
    );
  });

  it("U-ARTIST-010 — delete 409 mutates into a blocked reassignment dialog", async () => {
    apiGetMock.mockResolvedValue({ items: [artist()] });
    apiDeleteMock.mockRejectedValue({
      status: 409,
      code: "CONFLICT",
      message: "Artist has products attached",
      requestId: "r1",
      details: { blockingProductIds: ["p1", "p2"], hasMore: true },
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /delete aurora/i }));
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /reassign products first/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getAllByRole("link", { name: /reassign/i })[0]).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    expect(screen.getByText("p1")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /reassign/i })).toHaveLength(2);
    expect(screen.getByText(/more products/i)).toBeInTheDocument();
  });

  it("role guard — customer hitting /admin/artists sees forbidden content", () => {
    seedCustomer();
    apiGetMock.mockResolvedValue({ items: [] });
    renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create artist/i })).toBeNull();
  });
});
