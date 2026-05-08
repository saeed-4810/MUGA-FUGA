import { afterEach, describe, expect, it, vi } from "vitest";

import { getCroppedImageFile } from "./imageCrop";

const buildCanvasContextMock = (): Pick<
  CanvasRenderingContext2D,
  "drawImage" | "rotate" | "translate"
> => ({
  drawImage: vi.fn() as unknown as CanvasRenderingContext2D["drawImage"],
  rotate: vi.fn(),
  translate: vi.fn(),
});

const installImageMock = (mode: "load" | "error" = "load") => {
  class MockImage {
    crossOrigin = "";
    naturalHeight = 80;
    naturalWidth = 100;
    private listeners = new Map<string, () => void>();

    addEventListener(event: string, listener: () => void) {
      this.listeners.set(event, listener);
    }

    set src(_value: string) {
      queueMicrotask(() => this.listeners.get(mode)?.());
    }
  }

  vi.stubGlobal("Image", MockImage);
};

const installCanvasMock = ({
  blob = new Blob(["cropped"], { type: "image/jpeg" }),
  context = buildCanvasContextMock(),
}: {
  blob?: Blob | null;
  context?:
    | CanvasRenderingContext2D
    | null
    | Pick<CanvasRenderingContext2D, "drawImage" | "rotate" | "translate">;
} = {}) => {
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName !== "canvas") return originalCreateElement(tagName);

    return {
      height: 0,
      width: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(blob)),
    } as unknown as HTMLCanvasElement;
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getCroppedImageFile", () => {
  it("returns a square jpeg file using the requested crop and rotation", async () => {
    installImageMock();
    installCanvasMock();

    const file = await getCroppedImageFile({
      crop: { x: 4, y: 8, width: 256, height: 256 },
      fileName: "cover.png",
      imageSrc: "blob:cover",
      rotation: 90,
    });

    expect(file.name).toBe("cover.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("rejects when the browser cannot load the image", async () => {
    installImageMock("error");
    installCanvasMock();

    await expect(
      getCroppedImageFile({
        crop: { x: 0, y: 0, width: 1, height: 1 },
        fileName: "cover.jpg",
        imageSrc: "blob:broken",
        rotation: 0,
      })
    ).rejects.toThrow("Image failed to load");
  });

  it("rejects when canvas drawing is unavailable", async () => {
    installImageMock();
    installCanvasMock({ context: null });

    await expect(
      getCroppedImageFile({
        crop: { x: 0, y: 0, width: 1, height: 1 },
        fileName: "cover.jpg",
        imageSrc: "blob:cover",
        rotation: 0,
      })
    ).rejects.toThrow("Canvas is not supported");
  });

  it("rejects when the crop cannot be encoded", async () => {
    installImageMock();
    installCanvasMock({ blob: null });

    await expect(
      getCroppedImageFile({
        crop: { x: 0, y: 0, width: 1, height: 1 },
        fileName: "cover.jpg",
        imageSrc: "blob:cover",
        rotation: 0,
      })
    ).rejects.toThrow("Unable to crop image");
  });
});
