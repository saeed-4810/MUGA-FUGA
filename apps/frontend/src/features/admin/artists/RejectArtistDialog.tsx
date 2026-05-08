import { useTranslation } from "react-i18next";

import type { Artist } from "./types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RejectArtistDialogProps {
  artist: Artist | null;
  onClose: () => void;
  onConfirm: (artist: Artist) => void;
  reason: string;
  setReason: (reason: string) => void;
}

export const RejectArtistDialog = ({
  artist,
  onClose,
  onConfirm,
  reason,
  setReason,
}: RejectArtistDialogProps) => {
  const { t } = useTranslation("admin");

  return (
    <Dialog open={Boolean(artist)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("artists.reject.title", { name: artist?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("artists.reject.body")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="artist-reject-reason">{t("artists.reject.reason")}</Label>
          <Input
            id="artist-reject-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("artists.reject.placeholder")}
            value={reason}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("artists.reject.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => artist && onConfirm(artist)}>
            {t("artists.reject.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
