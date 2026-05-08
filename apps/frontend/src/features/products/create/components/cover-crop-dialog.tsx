import type { TFunction } from "i18next";
import Cropper, { type Area } from "react-easy-crop";

import type { useCoverArtCrop } from "../hooks/use-cover-art-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface CoverCropDialogProps {
  cropState: ReturnType<typeof useCoverArtCrop>;
  t: TFunction<["products", "artists"]>;
}

export const CoverCropDialog = ({ cropState, t }: CoverCropDialogProps) => (
  <Dialog open={cropState.cropDialogOpen} onOpenChange={cropState.setCropDialogOpen}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t("products:create.crop.title")}</DialogTitle>
        <DialogDescription>{t("products:create.crop.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div className="bg-muted relative h-72 overflow-hidden rounded-xl sm:h-96">
          {cropState.pendingPreview ? (
            <Cropper
              image={cropState.pendingPreview}
              crop={cropState.crop}
              disableAutomaticStylesInjection
              zoom={cropState.zoom}
              rotation={cropState.rotation}
              aspect={1}
              onCropChange={cropState.setCrop}
              onZoomChange={cropState.setZoom}
              onRotationChange={cropState.setRotation}
              onCropComplete={(_area: Area, areaPixels: Area) =>
                cropState.setCroppedAreaPixels(areaPixels)
              }
            />
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cover-zoom">{t("products:create.crop.zoom")}</Label>
            <Slider
              id="cover-zoom"
              min={1}
              max={3}
              step={0.1}
              value={[cropState.zoom]}
              onValueChange={([value]) => cropState.setZoom(value!)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover-rotation">{t("products:create.crop.rotation")}</Label>
            <Slider
              id="cover-rotation"
              min={0}
              max={360}
              step={1}
              value={[cropState.rotation]}
              onValueChange={([value]) => cropState.setRotation(value!)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => cropState.setCropDialogOpen(false)}
            type="button"
            variant="outline"
          >
            {t("products:create.actions.cancel")}
          </Button>
          <Button onClick={cropState.resetCrop} type="button" variant="outline">
            {t("products:create.crop.reset")}
          </Button>
          <Button onClick={() => void cropState.applyCrop()} type="button">
            {t("products:create.crop.apply")}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
);
