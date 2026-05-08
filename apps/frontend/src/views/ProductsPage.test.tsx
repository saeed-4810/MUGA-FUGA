import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const apiGetMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "usr_saeed_h", email: "saeedh582@gmail.com", role: "customer" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import { ProductsPage } from "./ProductsPage";

const renderPage = () => {
  window.history.pushState({}, "", "/products");
  return render(<ProductsPage />);
};

const renderServerPage = (props: React.ComponentProps<typeof ProductsPage>) => {
  window.history.pushState({}, "", "/products");
  return render(<ProductsPage {...props} />);
};

beforeEach(() => {
  apiGetMock.mockReset();
});

describe("ProductsPage — listing albums", () => {
  it("U-PROD-000 — when the server already pre-fetched products (SSR), we render them and don't refetch on the client", () => {
    renderServerPage({
      initialProducts: [
        {
          id: "prod_midnights",
          name: "Midnights",
          artist: { id: "art_taylor_swift", name: "Taylor Swift", status: "published" },
          coverArtPath: "cover-art/usr_saeed_h/midnights.jpg",
          status: "published",
          ownerEmail: "saeedh582@gmail.com",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ],
    });

    expect(screen.getByText("Midnights")).toBeInTheDocument();
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("U-PROD-000b — SSR error shape renders the error card without triggering a client refetch", () => {
    renderServerPage({
      initialError: {
        status: 500,
        code: "INTERNAL",
        message: "Firestore unavailable",
        requestId: "rid_server_001",
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL/);
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("U-PROD-001 — while loading, we show 6 aria-busy skeleton cards (matches the typical fold)", () => {
    apiGetMock.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    const skeletons = container.querySelectorAll('[aria-busy="true"]');
    expect(skeletons.length).toBe(6);
  });

  it("U-PROD-002 — empty list → 'No products yet' card with a 'Create product' CTA", () => {
    renderServerPage({ initialProducts: [] });
    expect(screen.getByText(/no products yet/i)).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: /create product/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it("U-PROD-003 — happy path renders cover image, album name, artist name, and status, with proper alt + lazy loading", () => {
    renderServerPage({
      initialProducts: [
        {
          id: "prod_midnights",
          name: "Midnights",
          artist: {
            id: "art_taylor_swift",
            name: "Taylor Swift",
            status: "published",
            imageUrl: "https://cdn.example/taylor.jpg",
          },
          coverArtPath: "cover-art/usr_saeed_h/midnights.jpg",
          coverArtUrl: "https://cdn.example/midnights.jpg",
          status: "published",
          ownerEmail: "saeedh582@gmail.com",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ],
    });
    expect(screen.getByText("Midnights")).toBeInTheDocument();
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
    expect(screen.getByText(/published/i)).toBeInTheDocument();
    const img = document.querySelector('img[src="https://cdn.example/midnights.jpg"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", expect.stringContaining("Midnights"));
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.getByLabelText(/midnights by taylor swift, published/i)).toBeInTheDocument();
  });

  it("U-PROD-004 — product without a coverArtUrl falls back to the music-note placeholder + initial avatar", () => {
    renderServerPage({
      initialProducts: [
        {
          id: "prod_quiet_demo",
          name: "Quiet Demo",
          artist: { id: "art_quiet_artist", name: "Quiet Artist", status: "published" },
          coverArtPath: "cover-art/usr_saeed_h/no-image.jpg",
          status: "pending",
          ownerEmail: "saeedh582@gmail.com",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ],
    });
    expect(screen.getByText("Quiet Demo")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: /no cover art/i })).toHaveTextContent("♪");
    expect(screen.getByText("Q")).toBeInTheDocument();
  });

  it("U-PROD-004b — whitespace-only artist name falls back to the music-note avatar (no crash, no blank initial)", () => {
    renderServerPage({
      initialProducts: [
        {
          id: "prod_instrumental",
          name: "Instrumental",
          artist: { id: "art_anon", name: "   ", status: "published" },
          coverArtPath: "cover-art/usr_saeed_h/instrumental.jpg",
          coverArtUrl: "https://cdn.example/instrumental.jpg",
          status: "published",
          ownerEmail: "saeedh582@gmail.com",
          createdAt: "2026-05-01T10:00:00Z",
        },
      ],
    });
    expect(screen.getByText("♪")).toBeInTheDocument();
  });

  it("U-PROD-005 — API error → role='alert' card showing the error code (so devs can grep logs)", () => {
    renderServerPage({
      initialError: {
        status: 500,
        code: "INTERNAL",
        message: "boom",
        requestId: "rid_inv_005",
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL/);
  });

  it("U-PROD-006 — header always exposes a 'Create product' link pointing at /products/new", () => {
    renderServerPage({ initialProducts: [] });
    const links = screen
      .getAllByRole("link", { name: /create product/i })
      .map((a) => a.getAttribute("href"));
    expect(links).toContain("/products/new");
  });
});
