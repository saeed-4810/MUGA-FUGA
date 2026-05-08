import { useState } from "react";

import { getCroppedImageFile, type PixelCrop } from "@/lib/imageCrop";

export const useCoverArtCrop = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleFile = (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      setPreview(null);
      return;
    }
    setPendingFile(nextFile);
    setPendingPreview(URL.createObjectURL(nextFile));
    resetCrop();
    setCroppedAreaPixels(null);
    setCropDialogOpen(true);
  };

  const applyCrop = async () => {
    const cropSourceFile = pendingFile!;
    const cropSourcePreview = pendingPreview!;
    try {
      const croppedFile = croppedAreaPixels
        ? await getCroppedImageFile({
            crop: croppedAreaPixels,
            fileName: cropSourceFile.name,
            imageSrc: cropSourcePreview,
            rotation,
          })
        : cropSourceFile;
      setFile(croppedFile);
      setPreview(URL.createObjectURL(croppedFile));
    } catch {
      setFile(cropSourceFile);
      setPreview(cropSourcePreview);
    } finally {
      setCropDialogOpen(false);
    }
  };

  return {
    applyCrop,
    crop,
    cropDialogOpen,
    file,
    handleFile,
    pendingPreview,
    preview,
    resetCrop,
    rotation,
    setCrop,
    setCropDialogOpen,
    setCroppedAreaPixels,
    setRotation,
    setZoom,
    zoom,
  };
};
