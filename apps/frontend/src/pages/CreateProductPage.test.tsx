/** U-PROD-001..006 — CreateProductPage shadcn wizard with Artist FK workflow. */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const uploadCoverArtMock = vi.fn();
vi.mock("../lib/uploads", () => ({
  uploadCoverArt: (...args: unknown[]) => uploadCoverArtMock(...args),
}));

const getCroppedImageFileMock = vi.hoisted(() =>
  vi.fn(({ fileName }: { fileName: string }) =>
    Promise.resolve(
      new File(["cropped"], fileName.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
    )
  )
);

vi.mock("react-easy-crop", () => ({
  default: ({
    onCropComplete,
  }: {
    onCropComplete: (_area: unknown, areaPixels: unknown) => void;
  }) => (
    <button
      data-testid="cropper"
      onClick={() => onCropComplete({}, { x: 4, y: 8, width: 128, height: 128 })}
      type="button"
    >
      cropper
    </button>
  ),
}));

vi.mock("../lib/imageCrop", () => ({
  getCroppedImageFile: (args: { fileName: string }) => getCroppedImageFileMock(args),
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

const chooseArtist = async (user: ReturnType<typeof userEvent.setup>, name = "Carol") => {
  const input = screen.getByRole("combobox", { name: /artist/i });
  await user.click(input);
  await user.clear(input);
  await user.type(input, name);
  await user.click(await screen.findByText(name));
};

const enterNameAndNext = async (user: ReturnType<typeof userEvent.setup>, name = "Album") => {
  await user.type(screen.getByLabelText(/product name/i), name);
  await user.click(screen.getByRole("button", { name: /^next$/i }));
};

const chooseArtistAndNext = async (user: ReturnType<typeof userEvent.setup>, name = "Carol") => {
  await chooseArtist(user, name);
  await user.click(screen.getByRole("button", { name: /^next$/i }));
};

const uploadCoverAndNext = async (user: ReturnType<typeof userEvent.setup>, file = makeImage()) => {
  await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, file);
  expect(screen.getByRole("dialog", { name: /edit cover art/i })).toBeInTheDocument();
  await user.click(screen.getByTestId("cropper"));
  await user.click(screen.getByRole("button", { name: /^apply$/i }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /edit cover art/i })).toBeNull());
  await user.click(screen.getByRole("button", { name: /^next$/i }));
};

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  getCroppedImageFileMock.mockClear();
  getCroppedImageFileMock.mockImplementation(({ fileName }: { fileName: string }) =>
    Promise.resolve(
      new File(["cropped"], fileName.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
    )
  );
  uploadCoverArtMock.mockReset();
  apiGetMock.mockResolvedValue({
    items: [{ id: "art-1", name: "Carol", status: "published" }],
  });
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });
});

describe("U-PROD-001..006: CreateProductPage", () => {
  it("U-PROD-001 — renders a gated first wizard step with next and cancel", () => {
    renderPage();
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /artist/i })).toBeNull();
    expect(screen.queryByLabelText(/cover art/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("U-PROD-001b — details step requires a product name before continuing", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/product name/i);
    expect(screen.queryByRole("combobox", { name: /artist/i })).toBeNull();
  });

  it("U-PROD-001c — back returns to the prior step and clears step validation errors", async () => {
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Backtrack Album");
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/choose an artist/i);
    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(/product name/i)).toHaveValue("Backtrack Album");
  });

  it("U-PROD-002 — selecting a file renders a cover preview image", async () => {
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user);
    await chooseArtistAndNext(user);
    await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, makeImage());
    expect(screen.getByRole("dialog", { name: /edit cover art/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull();
  });

  it("U-PROD-002c — crop reset, cancel, and fallback keep the original cover usable", async () => {
    getCroppedImageFileMock.mockRejectedValue(new Error("crop failed"));
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user);
    await chooseArtistAndNext(user);
    const input = screen.getByLabelText(/cover art/i) as HTMLInputElement;

    await user.upload(input, makeImage("cancelled.png", "image/png"));
    expect(screen.getByRole("dialog", { name: /edit cover art/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /edit cover art/i })).toBeNull()
    );
    expect(screen.getAllByText(/no cover selected/i).length).toBeGreaterThan(0);

    await user.upload(input, makeImage("fallback.png", "image/png"));
    const [zoomSlider, rotationSlider] = screen.getAllByRole("slider");
    fireEvent.keyDown(zoomSlider!, { key: "ArrowRight" });
    fireEvent.keyDown(rotationSlider!, { key: "ArrowRight" });
    await user.click(screen.getByTestId("cropper"));
    await user.click(screen.getByRole("button", { name: /^reset$/i }));
    await user.click(screen.getByRole("button", { name: /^apply$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /edit cover art/i })).toBeNull()
    );
    expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull();
    expect(getCroppedImageFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        crop: { x: 4, y: 8, width: 128, height: 128 },
        fileName: "fallback.png",
        imageSrc: "blob:mock",
        rotation: 0,
      })
    );
  });

  it("U-PROD-003 — submit without a cover surfaces the validation error", async () => {
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Album");
    await chooseArtistAndNext(user);
    (screen.getByLabelText(/cover art/i) as HTMLInputElement).removeAttribute("required");
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cover-art/i);
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("U-PROD-004 — happy path uploads, creates with artistId, navigates", async () => {
    uploadCoverArtMock.mockResolvedValue("cover-art/u1/path.jpg");
    apiPostMock.mockResolvedValue({ id: "p1" });
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Aurora");
    await chooseArtistAndNext(user);
    await uploadCoverAndNext(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByTestId("list")).toBeInTheDocument());
    expect(uploadCoverArtMock).toHaveBeenCalledTimes(1);
    expect(apiPostMock).toHaveBeenCalledWith("/products", {
      name: "Aurora",
      artistId: "art-1",
      coverArtPath: "cover-art/u1/path.jpg",
    });
  });

  it("U-PROD-005a — upload failure (ApiError shape) shows contextualised error", async () => {
    uploadCoverArtMock.mockRejectedValue({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "fileSize too big",
      requestId: "r1",
    });
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "X");
    await chooseArtistAndNext(user);
    await uploadCoverAndNext(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/submission failed.*VALIDATION_ERROR/i)
    );
  });

  it("U-PROD-005b — upload failure (plain Error) shows the generic message", async () => {
    uploadCoverArtMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "X");
    await chooseArtistAndNext(user);
    await uploadCoverAndNext(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/submission failed/i));
  });

  it("U-PROD-006 — cancel returns to /products without submitting", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByTestId("list")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-003b — submit button shows a spinner-backed 'Submitting…' state while in flight", async () => {
    let resolveUpload: ((v: string) => void) | undefined;
    uploadCoverArtMock.mockReturnValue(new Promise<string>((r) => (resolveUpload = r)));
    apiPostMock.mockResolvedValue({ id: "p1" });
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "X");
    await chooseArtistAndNext(user);
    await uploadCoverAndNext(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled());
    resolveUpload!("cover-art/u/x.jpg");
    await waitFor(() => expect(screen.getByTestId("list")).toBeInTheDocument());
  });

  it("U-PROD-002b — clearing the file input wipes the preview", async () => {
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user);
    await chooseArtistAndNext(user);
    const input = screen.getByLabelText(/cover art/i) as HTMLInputElement;
    await user.upload(input, makeImage());
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull();
    Object.defineProperty(input, "files", {
      configurable: true,
      get: () => [] as unknown as FileList,
    });
    fireEvent.change(input);
    await waitFor(() => expect(document.querySelector('img[src="blob:mock"]')).toBeNull());
  });

  it("U-PROD-004b — request artist dialog creates pending artist then product uses its id", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    uploadCoverArtMock.mockResolvedValue("cover-art/u1/path.jpg");
    apiPostMock
      .mockResolvedValueOnce({ id: "artist-new", name: "New Artist", status: "pending" })
      .mockResolvedValueOnce({ id: "p1" });
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "New Release");
    await user.click(screen.getByRole("combobox", { name: /artist/i }));
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "New Artist");
    await user.click(await screen.findByRole("button", { name: /add "new artist"/i }));
    expect(screen.getByRole("dialog", { name: /request a new artist/i })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: /request a new artist/i });
    const requestInput = within(dialog).getByDisplayValue("New Artist");
    await user.type(requestInput, " Changed");
    await user.click(screen.getByRole("button", { name: /^request$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(/both this artist and the product are approved/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    await uploadCoverAndNext(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByTestId("list")).toBeInTheDocument());
    expect(apiPostMock).toHaveBeenNthCalledWith(1, "/artists", { name: "New Artist Changed" });
    expect(apiPostMock).toHaveBeenNthCalledWith(2, "/products", {
      name: "New Release",
      artistId: "artist-new",
      coverArtPath: "cover-art/u1/path.jpg",
    });
  });

  it("U-PROD-003c — submit without selected artist surfaces validation error", async () => {
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Album");
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/choose an artist/i);
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-005c — request artist failure surfaces error and dialog can cancel", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce({
      status: 409,
      code: "CONFLICT",
      message: "artist exists",
      requestId: "r1",
    });
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Duplicate Release");
    await user.click(screen.getByRole("combobox", { name: /artist/i }));
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Duplicate");
    await user.click(await screen.findByRole("button", { name: /add "duplicate"/i }));
    await user.click(screen.getByRole("button", { name: /^request$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/artist request failed.*CONFLICT/i)
    );
    await user.click(screen.getByRole("dialog").querySelector("button")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("U-PROD-005d — request artist plain Error surfaces generic message", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Offline Release");
    await user.click(screen.getByRole("combobox", { name: /artist/i }));
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Offline Artist");
    await user.click(await screen.findByRole("button", { name: /add "offline artist"/i }));
    await user.click(screen.getByRole("button", { name: /^request$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/artist request failed/i)
    );
  });

  it("U-PROD-006b — Escape closes the artist request dialog", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await enterNameAndNext(user, "Escape Release");
    await user.click(screen.getByRole("combobox", { name: /artist/i }));
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Escape Artist");
    await user.click(await screen.findByRole("button", { name: /add "escape artist"/i }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
