/**
 * U-PROD-001..006 — ProductsPage states.
 *
 * Covers:
 *   - loading state renders 6 skeleton cards with aria-busy
 *   - empty state shows the empty card + create CTA
 *   - success state renders the grid with cover image, name, artist, status
 *   - missing cover URL falls back to the music-note placeholder
 *   - error state renders a role="alert" with the API code interpolated
 *   - blocked state (when RequireAuth redirects) is covered indirectly:
 *     unauthenticated users are routed to /login by the guard, which is
 *     verified end-to-end by the auth specs
 */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const apiGetMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "u1", email: "c@example.com", role: "customer" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import { ProductsPage } from "./ProductsPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/products"]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login">login</div>} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/new" element={<div data-testid="create">create</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  apiGetMock.mockReset();
});

describe("U-PROD-001..006: ProductsPage", () => {
  it("U-PROD-001 — loading state shows 6 aria-busy skeletons", () => {
    apiGetMock.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    const skeletons = container.querySelectorAll('[aria-busy="true"]');
    expect(skeletons.length).toBe(6);
  });

  it("U-PROD-002 — empty state shows the empty card + 'Create product' CTA", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no products yet/i)).toBeInTheDocument());
    // Header CTA + empty-state CTA
    const ctas = screen.getAllByRole("link", { name: /create product/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it("U-PROD-003 — success state renders cover, name, artist, status", async () => {
    apiGetMock.mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "Neon Lullabies",
          artist: {
            id: "art-1",
            name: "Aurora",
            status: "published",
            imageUrl: "https://cdn.example/artist.jpg",
          },
          coverArtPath: "cover-art/u/1.jpg",
          coverArtUrl: "https://cdn.example/cover1.jpg",
          status: "published",
          ownerEmail: "a@example.com",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Neon Lullabies")).toBeInTheDocument());
    expect(screen.getByText("Aurora")).toBeInTheDocument();
    expect(screen.getByText(/published/i)).toBeInTheDocument();
    const img = document.querySelector('img[src="https://cdn.example/cover1.jpg"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", expect.stringContaining("Neon Lullabies"));
    expect(img).toHaveAttribute("loading", "lazy");
    expect(document.querySelector('img[src="https://cdn.example/artist.jpg"]')).not.toBeNull();
  });

  it("U-PROD-004 — missing coverArtUrl falls back to the music-note placeholder", async () => {
    apiGetMock.mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "No Cover",
          artist: { id: "art-2", name: "Quiet Artist", status: "published" },
          coverArtPath: "cover-art/u/x.jpg",
          status: "pending",
          ownerEmail: "a@example.com",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("No Cover")).toBeInTheDocument());
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByText("♪")).toHaveLength(2);
  });

  it("U-PROD-005 — error state renders role=alert with the API code", async () => {
    apiGetMock.mockRejectedValue({
      status: 500,
      code: "INTERNAL",
      message: "boom",
      requestId: "req-1",
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL/);
  });

  it("U-PROD-006 — header always offers a 'Create product' link to /products/new", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no products yet/i)).toBeInTheDocument());
    const links = screen
      .getAllByRole("link", { name: /create product/i })
      .map((a) => a.getAttribute("href"));
    expect(links).toContain("/products/new");
  });
});
