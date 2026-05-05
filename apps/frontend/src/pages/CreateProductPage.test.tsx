/**
 * U-PROD-create — CreateProductPage form.
 *
 * Covers:
 *   - all 3 form fields render with proper labels
 *   - submit before choosing a cover shows a validation error
 *   - happy path: upload + create + navigate to /products
 *   - upload failure shows a contextualised error message (ApiError shape)
 *   - upload failure shows a contextualised error message (Error shape)
 *   - file selection renders a preview <img>
 *   - cancel returns to /products without submitting
 *   - submit button is disabled while submitting
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const apiPostMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const uploadCoverArtMock = vi.fn();
vi.mock("../lib/uploads", () => ({
  uploadCoverArt: (...args: unknown[]) => uploadCoverArtMock(...args),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "u1", email: "c@example.com", role: "customer" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import { CreateProductPage } from "./CreateProductPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/products/new"]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login">login</div>} />
        <Route path="/products" element={<div data-testid="list">list</div>} />
        <Route path="/products/new" element={<CreateProductPage />} />
      </Routes>
    </MemoryRouter>
  );

const makeImage = (name = "cover.jpg", type = "image/jpeg"): File =>
  new File(["bytes"], name, { type });

beforeEach(() => {
  apiPostMock.mockReset();
  uploadCoverArtMock.mockReset();
  // jsdom's URL.createObjectURL is undefined by default
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });
});

describe("U-PROD-create: CreateProductPage", () => {
  it("U-PROD-create-001 — renders 3 form fields + submit + cancel", () => {
    renderPage();
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artist name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cover art/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("U-PROD-create-002 — selecting a file renders a preview image", async () => {
    renderPage();
    const file = makeImage();
    const fileInput = screen.getByLabelText(/cover art/i) as HTMLInputElement;
    await userEvent.upload(fileInput, file);
    const preview = document.querySelector('img[src="blob:mock"]');
    expect(preview).not.toBeNull();
  });

  it("U-PROD-create-003 — submit without a cover surfaces the validation error", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/product name/i), "Album");
    await user.type(screen.getByLabelText(/artist name/i), "Artist");
    // Bypass the native required attribute (jsdom respects it; clear it)
    (screen.getByLabelText(/cover art/i) as HTMLInputElement).removeAttribute("required");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cover-art/i);
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-004 — happy path uploads, creates, navigates to /products", async () => {
    uploadCoverArtMock.mockResolvedValue("cover-art/u1/path.jpg");
    apiPostMock.mockResolvedValue({ id: "p1" });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/product name/i), "Aurora");
    await user.type(screen.getByLabelText(/artist name/i), "Carol");
    await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, makeImage());
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByTestId("list")).toBeInTheDocument());
    expect(uploadCoverArtMock).toHaveBeenCalledTimes(1);
    expect(apiPostMock).toHaveBeenCalledWith("/products", {
      name: "Aurora",
      artistName: "Carol",
      coverArtPath: "cover-art/u1/path.jpg",
    });
  });

  it("U-PROD-create-005 — upload failure (ApiError shape) shows contextualised error", async () => {
    uploadCoverArtMock.mockRejectedValue({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "fileSize too big",
      requestId: "r1",
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/product name/i), "X");
    await user.type(screen.getByLabelText(/artist name/i), "Y");
    await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, makeImage());
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/VALIDATION_ERROR/);
  });

  it("U-PROD-create-006 — upload failure (plain Error) shows the message", async () => {
    uploadCoverArtMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/product name/i), "X");
    await user.type(screen.getByLabelText(/artist name/i), "Y");
    await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, makeImage());
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/network down/);
  });

  it("U-PROD-create-007 — cancel returns to /products without submitting", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByTestId("list")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-008 — submit button shows 'Submitting…' while in flight", async () => {
    let resolveUpload: ((v: string) => void) | undefined;
    uploadCoverArtMock.mockReturnValue(
      new Promise<string>((r) => {
        resolveUpload = r;
      })
    );
    apiPostMock.mockResolvedValue({ id: "p1" });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/product name/i), "X");
    await user.type(screen.getByLabelText(/artist name/i), "Y");
    await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, makeImage());
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    // While upload is in flight: button shows "Submitting…" and is disabled
    await waitFor(() => expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled());
    // Resolve to let the test settle
    resolveUpload!("cover-art/u/x.jpg");
    await waitFor(() => expect(screen.getByTestId("list")).toBeInTheDocument());
  });

  it("U-PROD-create-009 — clearing the file input wipes the preview", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText(/cover art/i) as HTMLInputElement;
    await user.upload(input, makeImage());
    expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull();
    // userEvent.upload with empty file array does not fire change consistently;
    // simulate the "no file" change event directly so the cleared-preview branch
    // (line 23 — handleFile(null) → setPreview(null)) runs.
    Object.defineProperty(input, "files", {
      configurable: true,
      get: () => [] as unknown as FileList,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => expect(document.querySelector('img[src="blob:mock"]')).toBeNull());
  });
});
