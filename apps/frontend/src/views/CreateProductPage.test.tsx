import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCroppedImageFileMock = vi.hoisted(() => vi.fn());
const cropperMockState = vi.hoisted(() => ({ cropCompleteSent: false, skipCropComplete: false }));

vi.mock("react-easy-crop", () => ({
  default: ({
    onCropComplete,
  }: {
    onCropComplete: (area: unknown, areaPixels: unknown) => void;
  }) => {
    if (!cropperMockState.skipCropComplete && !cropperMockState.cropCompleteSent) {
      cropperMockState.cropCompleteSent = true;
      queueMicrotask(() =>
        onCropComplete(
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 8, y: 12, width: 512, height: 512 }
        )
      );
    }
    return null;
  },
}));

vi.mock("@/lib/imageCrop", () => ({
  getCroppedImageFile: (...args: unknown[]) => getCroppedImageFileMock(...args),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ id, onValueChange }: { id?: string; onValueChange?: (value: number[]) => void }) => (
    <button onClick={() => onValueChange?.([2])} type="button">
      {id}
    </button>
  ),
}));

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const uploadCoverArtMock = vi.fn();
vi.mock("@/lib/uploads", () => ({
  uploadCoverArt: (...args: unknown[]) => uploadCoverArtMock(...args),
}));

const navigateToMock = vi.fn();
vi.mock("@/lib/navigation", () => ({
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "usr_saeed_h", email: "saeedh582@gmail.com", role: "customer" },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

import { CreateProductPage } from "./CreateProductPage";

const publishedArtist = {
  id: "art_phoebe_bridgers",
  name: "Phoebe Bridgers",
  status: "published" as const,
};

const renderPage = (initialArtistOptions = [publishedArtist]) => {
  window.history.pushState({}, "", "/products/new");
  return render(<CreateProductPage initialArtistOptions={initialArtistOptions} />);
};

const makeImage = (name = "cover.jpg", type = "image/jpeg"): File =>
  new File(["bytes"], name, { type });

const clickNext = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /^next$/i }));
};

const completeDetails = async (user: ReturnType<typeof userEvent.setup>, name = "Punisher") => {
  await user.type(screen.getByLabelText(/product name/i), name);
  await clickNext(user);
};

const chooseArtist = async (user: ReturnType<typeof userEvent.setup>, name = "Phoebe Bridgers") => {
  const input = screen.getByRole("combobox", { name: /artist/i });
  await user.click(input);
  await user.clear(input);
  await user.type(input, name);
  await user.click(await screen.findByText(name));
};

const completeArtist = async (user: ReturnType<typeof userEvent.setup>) => {
  await chooseArtist(user);
  await clickNext(user);
};

const completeCover = async (user: ReturnType<typeof userEvent.setup>, file = makeImage()) => {
  await user.upload(screen.getByLabelText(/cover art/i) as HTMLInputElement, file);
  await user.click(await screen.findByRole("button", { name: /^apply$/i }));
  await clickNext(user);
};

const reachReview = async (user: ReturnType<typeof userEvent.setup>, name = "Punisher") => {
  await completeDetails(user, name);
  await completeArtist(user);
  await completeCover(user);
};

beforeEach(() => {
  cropperMockState.cropCompleteSent = false;
  cropperMockState.skipCropComplete = false;
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  uploadCoverArtMock.mockReset();
  navigateToMock.mockReset();
  apiGetMock.mockResolvedValue({ items: [publishedArtist] });
  getCroppedImageFileMock.mockReset();
  getCroppedImageFileMock.mockImplementation(({ fileName }: { fileName: string }) =>
    Promise.resolve(
      new File(["cropped-bytes"], fileName.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
    )
  );
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });
});

describe("CreateProductPage — 4-step product wizard", () => {
  it("U-PROD-create-001 — wizard chrome shows up: title, step list, step 1 of 4 indicator, summary panel, Next button", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /create product/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /create product steps/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/submission summary/i)).toBeInTheDocument();
    expect(screen.getByText(/no product name yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
  });

  it("U-PROD-create-001b — renders with default props", () => {
    render(<CreateProductPage />);
    expect(screen.getByRole("heading", { name: /create product/i })).toBeInTheDocument();
  });

  it("U-PROD-create-002 — blocks details step until name is entered", async () => {
    const user = userEvent.setup();
    renderPage();
    await clickNext(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/product name/i);
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
  });

  it("U-PROD-create-003 — details step advances to artist and back preserves values", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user, "Stranger in the Alps");
    expect(screen.getByRole("combobox", { name: /artist/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByLabelText(/product name/i)).toHaveValue("Stranger in the Alps");
  });

  it("U-PROD-create-004 — blocks artist step until a published artist is selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user);
    await clickNext(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/choose an artist/i);
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-005 — pending artist requests are visible but block product submission", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockResolvedValueOnce({
      id: "art_lucy_dacus_pending",
      name: "Lucy Dacus",
      status: "pending",
    });
    const user = userEvent.setup();
    renderPage([]);

    await completeDetails(user, "Demo Tape");
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Lucy Dacus");
    await user.click(await screen.findByRole("button", { name: /add "lucy dacus"/i }));
    await user.type(
      within(screen.getByRole("dialog", { name: /request a new artist/i })).getByLabelText(
        /artist/i
      ),
      " (touring)"
    );
    await user.click(screen.getByRole("button", { name: /^request$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(/waiting for admin approval/i)).toBeInTheDocument();
    await clickNext(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/artist is waiting/i);
    expect(apiPostMock).toHaveBeenCalledWith("/artists", { name: "Lucy Dacus (touring)" });
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-006 — selecting a file renders preview and review summary", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user, "Punisher (Deluxe)");
    await completeArtist(user);
    await user.upload(
      screen.getByLabelText(/cover art/i) as HTMLInputElement,
      makeImage("preview.png", "image/png")
    );
    expect(screen.getByRole("dialog", { name: /edit cover art/i })).toBeInTheDocument();
    expect(screen.getByText(/crop the artwork/i)).toBeInTheDocument();
    expect(screen.getByText(/^zoom$/i)).toBeInTheDocument();
    expect(screen.getByText(/^rotation$/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull();
    await clickNext(user);
    expect(screen.getByText("Punisher (Deluxe)")).toBeInTheDocument();
    expect(screen.getByText("preview.jpg")).toBeInTheDocument();
    expect(getCroppedImageFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "preview.png", imageSrc: "blob:mock", rotation: 0 })
    );
  });

  it("U-PROD-create-006b — reset keeps crop controls usable before applying", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user, "Punisher (Deluxe)");
    await completeArtist(user);
    await user.upload(
      screen.getByLabelText(/cover art/i) as HTMLInputElement,
      makeImage("reset.png", "image/png")
    );
    await user.click(await screen.findByRole("button", { name: "cover-zoom" }));
    await user.click(screen.getByRole("button", { name: "cover-rotation" }));
    await user.click(await screen.findByRole("button", { name: /^reset$/i }));
    await user.click(screen.getByRole("button", { name: /^apply$/i }));
    await clickNext(user);
    expect(screen.getByText("reset.jpg")).toBeInTheDocument();
  });

  it("U-PROD-create-006c — apply without crop pixels keeps the original selected file", async () => {
    cropperMockState.skipCropComplete = true;
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user, "Punisher (Deluxe)");
    await completeArtist(user);
    await user.upload(
      screen.getByLabelText(/cover art/i) as HTMLInputElement,
      makeImage("original.png", "image/png")
    );
    await user.click(await screen.findByRole("button", { name: /^apply$/i }));
    await clickNext(user);
    expect(screen.getByText("original.png")).toBeInTheDocument();
    expect(getCroppedImageFileMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-006d — crop failure falls back to the original selected file", async () => {
    getCroppedImageFileMock.mockRejectedValueOnce(new Error("canvas unavailable"));
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user, "Punisher (Deluxe)");
    await completeArtist(user);
    await user.upload(
      screen.getByLabelText(/cover art/i) as HTMLInputElement,
      makeImage("fallback.png", "image/png")
    );
    await user.click(await screen.findByRole("button", { name: /^apply$/i }));
    await clickNext(user);
    expect(screen.getByText("fallback.png")).toBeInTheDocument();
  });

  it("U-PROD-create-006e — cancelling crop keeps the cover step empty", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user, "Punisher (Deluxe)");
    await completeArtist(user);
    await user.upload(
      screen.getByLabelText(/cover art/i) as HTMLInputElement,
      makeImage("cancel.png", "image/png")
    );
    await user.click(await screen.findByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog", { name: /edit cover art/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/no cover selected yet/i)).toHaveLength(2);
  });

  it("U-PROD-create-007 — cover step validates file selection", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user);
    await completeArtist(user);
    await clickNext(user);
    expect(screen.getByRole("alert")).toHaveTextContent(/cover-art/i);
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-008 — happy path uploads, creates with artistId, navigates", async () => {
    uploadCoverArtMock.mockResolvedValue("cover-art/usr_saeed_h/punisher.jpg");
    apiPostMock.mockResolvedValue({ id: "prod_punisher" });
    const user = userEvent.setup();
    renderPage();
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(navigateToMock).toHaveBeenCalledWith("/products"));
    expect(uploadCoverArtMock).toHaveBeenCalledTimes(1);
    expect(apiPostMock).toHaveBeenCalledWith("/products", {
      name: "Punisher",
      artistId: "art_phoebe_bridgers",
      coverArtPath: "cover-art/usr_saeed_h/punisher.jpg",
    });
  });

  it("U-PROD-create-009 — submit button shows in-flight copy", async () => {
    let resolveUpload: ((value: string) => void) | undefined;
    uploadCoverArtMock.mockReturnValue(new Promise<string>((resolve) => (resolveUpload = resolve)));
    apiPostMock.mockResolvedValue({ id: "prod_punisher" });
    const user = userEvent.setup();
    renderPage();
    await reachReview(user, "Saviour Complex");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled());
    resolveUpload!("cover-art/usr_saeed_h/x.jpg");
    await waitFor(() => expect(navigateToMock).toHaveBeenCalledWith("/products"));
  });

  it("U-PROD-create-010 — ApiError submit failure shows contextualised code", async () => {
    uploadCoverArtMock.mockRejectedValue({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "too big",
    });
    const user = userEvent.setup();
    renderPage();
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/VALIDATION_ERROR/i));
  });

  it("U-PROD-create-011 — plain submit failure shows the message", async () => {
    uploadCoverArtMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    renderPage();
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/network down/i));
  });

  it("U-PROD-create-011b — unknown submit failure falls back to safe copy", async () => {
    uploadCoverArtMock.mockRejectedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't create the product/i)
    );
  });

  it("U-PROD-create-011c — object submit failure without message falls back to safe copy", async () => {
    uploadCoverArtMock.mockRejectedValue({});
    const user = userEvent.setup();
    renderPage();
    await reachReview(user);
    await user.click(screen.getByRole("button", { name: /^submit$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't create the product/i)
    );
  });

  it("U-PROD-create-012 — clearing file input wipes preview and summary", async () => {
    const user = userEvent.setup();
    renderPage();
    await completeDetails(user);
    await completeArtist(user);
    const input = screen.getByLabelText(/cover art/i) as HTMLInputElement;
    await user.upload(input, makeImage());
    await user.click(await screen.findByRole("button", { name: /^apply$/i }));
    expect(document.querySelector('img[src="blob:mock"]')).not.toBeNull();
    Object.defineProperty(input, "files", {
      configurable: true,
      get: () => [] as unknown as FileList,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => expect(document.querySelector('img[src="blob:mock"]')).toBeNull());
    expect(screen.getAllByText(/no cover selected yet/i)).toHaveLength(2);
  });

  it("U-PROD-create-013 — cancel returns to products without submitting", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(navigateToMock).toHaveBeenCalledWith("/products");
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(uploadCoverArtMock).not.toHaveBeenCalled();
  });

  it("U-PROD-create-014 — request artist failure surfaces errors and dialog can close", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce({ status: 409, code: "CONFLICT", message: "artist exists" });
    const user = userEvent.setup();
    renderPage([]);
    await completeDetails(user);
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Phoebe Bridgers");
    await user.click(await screen.findByRole("button", { name: /add "phoebe bridgers"/i }));
    await user.click(screen.getByRole("button", { name: /^request$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/CONFLICT/i));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("U-PROD-create-015 — request artist plain Error surfaces its message and Escape closes", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    apiPostMock.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    renderPage([]);
    await completeDetails(user);
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Boygenius");
    await user.click(await screen.findByRole("button", { name: /add "boygenius"/i }));
    await user.click(screen.getByRole("button", { name: /^request$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/offline/i));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("U-PROD-create-016 — request artist dialog close button dismisses without submitting", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage([]);
    await completeDetails(user);
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "Bright Eyes");
    await user.click(await screen.findByRole("button", { name: /add "bright eyes"/i }));
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});
