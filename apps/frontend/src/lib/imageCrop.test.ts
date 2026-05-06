import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCroppedImageFile } from "./imageCrop";

type ImageListener = () => void;

class MockImage {
  crossOrigin = "";
  naturalHeight = 50;
  naturalWidth = 100;
  private listeners = new Map<string, ImageListener>();

  addEventListener(event: string, listener: ImageListener) {
    this.listeners.set(event, listener);
  }

  set src(value: string) {
    queueMicrotask(() => this.listeners.get(value === "broken" ? "error" : "load")?.());
  }
}

const context = {
  drawImage: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
};

const originalImage = globalThis.Image;
const originalCreateElement = document.createElement.bind(document);

describe("imageCrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it("U-PROD-CROP-001 — renders the rotated crop to a jpeg File", async () => {
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName !== "canvas") return originalCreateElement(tagName);
      return {
        getContext: vi.fn(() => context),
        height: 0,
        toBlob: vi.fn((callback: BlobCallback) =>
          callback(new Blob(["jpeg"], { type: "image/jpeg" }))
        ),
        width: 0,
      } as unknown as HTMLCanvasElement;
    });

    const file = await getCroppedImageFile({
      crop: { x: 10, y: 20, width: 32, height: 32 },
      fileName: "cover.png",
      imageSrc: "blob:cover",
      rotation: 90,
    });

    expect(file.name).toBe("cover.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
  });

  it("U-PROD-CROP-002 — rejects when the image cannot load", async () => {
    await expect(
      getCroppedImageFile({
        crop: { x: 0, y: 0, width: 32, height: 32 },
        fileName: "cover.png",
        imageSrc: "broken",
        rotation: 0,
      })
    ).rejects.toThrow("Image failed to load");
  });

  it("U-PROD-CROP-003 — rejects when canvas APIs are unavailable", async () => {
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName !== "canvas") return originalCreateElement(tagName);
      return { getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
    });

    await expect(
      getCroppedImageFile({
        crop: { x: 0, y: 0, width: 32, height: 32 },
        fileName: "cover.png",
        imageSrc: "blob:cover",
        rotation: 0,
      })
    ).rejects.toThrow("Canvas is not supported");
  });

  it("U-PROD-CROP-004 — rejects when canvas cannot produce a blob", async () => {
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName !== "canvas") return originalCreateElement(tagName);
      return {
        getContext: vi.fn(() => context),
        height: 0,
        toBlob: vi.fn((callback: BlobCallback) => callback(null)),
        width: 0,
      } as unknown as HTMLCanvasElement;
    });

    await expect(
      getCroppedImageFile({
        crop: { x: 0, y: 0, width: 32, height: 32 },
        fileName: "cover.png",
        imageSrc: "blob:cover",
        rotation: 0,
      })
    ).rejects.toThrow("Unable to crop image");
  });
});
