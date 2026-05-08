import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  id: overrides.id ?? "art_taylor_swift",
  name: overrides.name ?? "Taylor Swift",
  ...(overrides.bio !== undefined ? { bio: overrides.bio } : {}),
  ...(overrides.country === null ? {} : { country: overrides.country ?? "US" }),
  ...(overrides.imageUrl !== undefined ? { imageUrl: overrides.imageUrl } : {}),
  ...(overrides.imageObjectPath !== undefined
    ? { imageObjectPath: overrides.imageObjectPath }
    : {}),
  status: overrides.status ?? "published",
  ownerEmail: "saeedh582@gmail.com",
  createdAt: "2026-05-05T10:00:00Z",
});

const seedAdmin = () =>
  useAuthMock.mockReturnValue({
    user: { uid: "usr_marcus_admin", email: "marcus@muga.app", role: "admin" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

type ArtistsPageProps = Parameters<typeof ArtistsPage>[0];

const renderPage = (props?: ArtistsPageProps) => {
  window.history.pushState({}, "", "/admin/artists");
  return render(<ArtistsPage {...props} />);
};

const fetchMock = vi.fn();

beforeEach(() => {
  seedAdmin();
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiPatchMock.mockReset();
  apiDeleteMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:preview") });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Admin ArtistsPage — list, create, edit, approve/reject, delete", () => {
  it("U-ARTIST-001 — initial render shows the aria-busy skeleton; we don't refetch if SSR didn't pre-fill", () => {
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("U-ARTIST-002 — empty states change with the status filter and refetch published", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    expect(screen.getByText(/no published artists yet/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() => expect(apiGetMock).toHaveBeenLastCalledWith("/artists?status=pending"));
    expect(screen.getByText(/no artists pending review/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/status/i), "published");
    await waitFor(() => expect(apiGetMock).toHaveBeenLastCalledWith("/artists?status=published"));
  });

  it("U-ARTIST-003 — API errors render a user-safe alert", async () => {
    renderPage({
      initialError: {
        status: 500,
        code: "INTERNAL",
        message: "boom",
        requestId: "rid_inv_001",
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*boom/i);
  });

  it("U-ARTIST-004 — list renders image, fallback thumb, metadata, status pill, and actions", async () => {
    renderPage({
      initialItems: [
        artist({ imageUrl: "https://cdn.example.com/taylor.jpg" }),
        artist({ id: "art_daft_punk", name: "Daft Punk", country: null }),
      ],
    });
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
    expect(screen.getByAltText(/cover image for taylor swift/i)).toBeInTheDocument();
    expect(screen.getByText("Daft Punk")).toBeInTheDocument();
    expect(screen.getAllByText("Published")).toHaveLength(3);
    expect(screen.getAllByText("saeedh582@gmail.com")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /edit taylor swift/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete taylor swift/i })).toBeInTheDocument();
  });

  it("U-ARTIST-005 — pending artists can be approved and rejected inline", async () => {
    apiGetMock
      .mockResolvedValueOnce({ items: [artist({ status: "pending" })] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artist({ status: "pending" })] })
      .mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /approve taylor swift/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /approve taylor swift/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists/art_taylor_swift/approve", {});
    await user.selectOptions(screen.getByLabelText(/status/i), "published");
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reject taylor swift/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /reject taylor swift/i }));
    await user.type(screen.getByLabelText(/reason/i), "not ready");
    await user.click(screen.getByRole("button", { name: /reject artist/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists/art_taylor_swift/reject", {
      reason: "not ready",
    });
  });

  it("U-ARTIST-005b — rejected status filter renders rejected status pills", async () => {
    apiGetMock.mockResolvedValueOnce({ items: [artist({ status: "rejected" })] });
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.selectOptions(screen.getByLabelText(/status/i), "rejected");
    await waitFor(() => expect(screen.getByText("Taylor Swift")).toBeInTheDocument());
    expect(screen.getAllByText("Rejected")).toHaveLength(2);
  });

  it("U-ARTIST-005c — rejecting with no reason posts an empty body", async () => {
    apiGetMock
      .mockResolvedValueOnce({ items: [artist({ status: "pending" })] })
      .mockResolvedValueOnce({ items: [] });
    apiPostMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reject taylor swift/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /reject taylor swift/i }));
    await user.click(screen.getByRole("button", { name: /reject artist/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists/art_taylor_swift/reject", {});
  });

  it("U-ARTIST-005d — reject dialog can be cancelled and dismissed", async () => {
    apiGetMock.mockResolvedValueOnce({ items: [artist({ status: "pending" })] });
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.selectOptions(screen.getByLabelText(/status/i), "pending");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reject taylor swift/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /reject taylor swift/i }));
    expect(screen.getByRole("dialog", { name: /reject taylor swift/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /reject taylor swift/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /reject taylor swift/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog", { name: /reject taylor swift/i })).toBeNull();
  });

  it("U-ARTIST-006 — create drawer posts a trimmed artist payload", async () => {
    apiPostMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "  Tame Impala  ");
    await user.type(screen.getByLabelText(/^bio$/i), "  Australian psychedelic project  ");
    await user.type(screen.getByLabelText(/^country$/i), "au");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    expect(apiPostMock).toHaveBeenCalledWith("/artists", {
      name: "Tame Impala",
      bio: "Australian psychedelic project",
      country: "AU",
    });
  });

  it("U-ARTIST-007 — image upload requests an artist signed URL and stores the object path", async () => {
    apiPostMock
      .mockResolvedValueOnce({
        uploadUrl: "https://upload.example.com",
        objectPath: "artist-images/usr_saeed_h/taylor.png",
        expiresAt: "2026-05-05T11:00:00Z",
      })
      .mockResolvedValueOnce({});
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Phoebe Bridgers");
    const file = new File(["x"], "artist.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/image/i), file);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://upload.example.com",
        expect.objectContaining({ method: "PUT", body: file })
      )
    );
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    expect(apiPostMock).toHaveBeenLastCalledWith("/artists", {
      name: "Phoebe Bridgers",
      imageObjectPath: "artist-images/usr_saeed_h/taylor.png",
    });
  });

  it("U-ARTIST-007a — save waits until the selected artist image finishes uploading", async () => {
    let resolveUpload!: (response: Response) => void;
    apiPostMock.mockResolvedValueOnce({
      uploadUrl: "https://upload.example.com",
      objectPath: "artist-images/usr_saeed_h/taylor.png",
      expiresAt: "2026-05-05T11:00:00Z",
    });
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveUpload = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Phoebe Bridgers");
    await user.upload(
      screen.getByLabelText(/image/i),
      new File(["x"], "artist.png", { type: "image/png" })
    );
    expect(screen.getByRole("button", { name: /uploading image/i })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText(/^name$/i).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/wait for the image upload/i);
    resolveUpload(new Response(null, { status: 200 }));
    await waitFor(() => expect(screen.getByRole("button", { name: /save artist/i })).toBeEnabled());
  });

  it("U-ARTIST-007b — image upload PUT failure renders an upload error", async () => {
    apiPostMock.mockResolvedValueOnce({
      uploadUrl: "https://upload.example.com",
      objectPath: "artist-images/usr_saeed_h/taylor.png",
      expiresAt: "2026-05-05T11:00:00Z",
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
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
    apiPostMock.mockRejectedValueOnce("network down");
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
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
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    fireEvent.change(screen.getByLabelText(/image/i), { target: { files: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("U-ARTIST-007d — editor dialog focuses the form and Escape closes", async () => {
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    expect(screen.getByRole("dialog", { name: /create artist/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /create artist/i })).toBeNull();
  });

  it("U-ARTIST-007e — create submit API errors render inside the editor", async () => {
    apiPostMock.mockRejectedValueOnce({
      status: 409,
      code: "CONFLICT",
      message: "duplicate",
      requestId: "rid_inv_001",
    });
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Taylor Swift");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/CONFLICT.*duplicate/i)
    );
  });

  it("U-ARTIST-007f — create submit plain errors render inside the editor", async () => {
    apiPostMock.mockRejectedValueOnce(new Error("plain failure"));
    const user = userEvent.setup();
    renderPage({ initialItems: [] });
    await user.click(await screen.findByRole("button", { name: /create artist/i }));
    await user.type(screen.getByLabelText(/^name$/i), "Taylor Swift");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/plain failure/i));
  });

  it("U-ARTIST-008 — edit drawer patches existing artist details", async () => {
    apiPatchMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage({
      initialItems: [
        artist({ bio: "old", imageObjectPath: "artist-images/usr_saeed_h/taylor-old.png" }),
      ],
    });
    await user.click(await screen.findByRole("button", { name: /edit taylor swift/i }));
    await user.clear(screen.getByLabelText(/^bio$/i));
    await user.type(screen.getByLabelText(/^bio$/i), "Updated bio");
    await user.click(screen.getByRole("button", { name: /save artist/i }));
    expect(apiPatchMock).toHaveBeenCalledWith("/artists/art_taylor_swift", {
      name: "Taylor Swift",
      bio: "Updated bio",
      country: "US",
      imageObjectPath: "artist-images/usr_saeed_h/taylor-old.png",
    });
  });

  it("U-ARTIST-009 — delete confirms, calls API, and reloads", async () => {
    apiGetMock.mockResolvedValueOnce({ items: [] });
    apiDeleteMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage({ initialItems: [artist()] });
    await user.click(await screen.findByRole("button", { name: /delete taylor swift/i }));
    expect(screen.getByRole("dialog", { name: /delete artist/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    expect(apiDeleteMock).toHaveBeenCalledWith("/artists/art_taylor_swift");
    await waitFor(() => expect(screen.getByText(/no published artists yet/i)).toBeInTheDocument());
  });

  it("U-ARTIST-009b — delete dialog can be cancelled and closed with Escape", async () => {
    const user = userEvent.setup();
    renderPage({ initialItems: [artist()] });
    await user.click(await screen.findByRole("button", { name: /delete taylor swift/i }));
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: /delete artist/i })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /delete artist/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /delete taylor swift/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /delete artist/i })).toBeNull();
  });

  it("U-ARTIST-009c — non-conflict delete errors surface as a page alert", async () => {
    apiDeleteMock.mockRejectedValue({
      status: 500,
      code: "INTERNAL",
      message: "boom",
      requestId: "rid_inv_001",
    });
    const user = userEvent.setup();
    renderPage({ initialItems: [artist()] });
    await user.click(await screen.findByRole("button", { name: /delete taylor swift/i }));
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL.*boom/i));
  });

  it("U-ARTIST-009d — malformed delete 409 details surface as a page alert", async () => {
    apiDeleteMock.mockRejectedValue({
      status: 409,
      code: "CONFLICT",
      message: "Artist has products attached",
      requestId: "rid_inv_001",
    });
    const user = userEvent.setup();
    renderPage({ initialItems: [artist()] });
    await user.click(await screen.findByRole("button", { name: /delete taylor swift/i }));
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/CONFLICT.*products attached/i)
    );
  });

  it("U-ARTIST-010 — delete 409 mutates into a blocked reassignment dialog", async () => {
    apiDeleteMock.mockRejectedValue({
      status: 409,
      code: "CONFLICT",
      message: "Artist has products attached",
      requestId: "rid_inv_001",
      details: { blockingProductIds: ["prod_midnights", "prod_1989"], hasMore: true },
    });
    const user = userEvent.setup();
    renderPage({ initialItems: [artist()] });
    await user.click(await screen.findByRole("button", { name: /delete taylor swift/i }));
    await user.click(screen.getByRole("button", { name: /delete artist/i }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /reassign products first/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getAllByRole("link", { name: /reassign/i })[0]).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    expect(screen.getByText("prod_midnights")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /reassign/i })).toHaveLength(2);
    expect(screen.getByText(/more products/i)).toBeInTheDocument();
  });
});
