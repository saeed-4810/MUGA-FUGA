export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Image failed to load")));
    image.src = src;
  });

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const getCroppedImageFile = async ({
  crop,
  fileName,
  imageSrc,
  rotation,
}: {
  crop: PixelCrop;
  fileName: string;
  imageSrc: string;
  rotation: number;
}): Promise<File> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");

  const radians = degreesToRadians(rotation);
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const boundingWidth = image.naturalWidth * cos + image.naturalHeight * sin;
  const boundingHeight = image.naturalWidth * sin + image.naturalHeight * cos;

  canvas.width = crop.width;
  canvas.height = crop.height;
  context.translate(-crop.x, -crop.y);
  context.translate(boundingWidth / 2, boundingHeight / 2);
  context.rotate(radians);
  context.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  context.drawImage(image, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Unable to crop image"));
      },
      "image/jpeg",
      0.92
    );
  });

  return new File([blob], fileName.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
};
