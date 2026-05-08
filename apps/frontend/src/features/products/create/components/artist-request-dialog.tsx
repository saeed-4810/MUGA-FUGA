import type { TFunction } from "i18next";

import { StatusBanner } from "@/components/Composition";
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

interface ArtistRequestDialogProps {
  onRequestArtist: (artistName: string) => Promise<void>;
  requestError: string | null;
  requestName: string | null;
  setRequestName: (name: string | null) => void;
  submitting: boolean;
  t: TFunction<["products", "artists"]>;
}

export const ArtistRequestDialog = ({
  onRequestArtist,
  requestError,
  requestName,
  setRequestName,
  submitting,
  t,
}: ArtistRequestDialogProps) => (
  <Dialog open={requestName !== null} onOpenChange={(open) => !open && setRequestName(null)}>
    <DialogContent aria-label={t("artists:request.title")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (requestName?.trim()) void onRequestArtist(requestName);
        }}
      >
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("artists:request.title")}</DialogTitle>
            <DialogDescription>{t("artists:request.body")}</DialogDescription>
          </DialogHeader>
          {requestError && (
            <StatusBanner role="alert" tone="danger">
              {requestError}
            </StatusBanner>
          )}
          <div className="space-y-2">
            <Label htmlFor="artist-request-name">{t("artists:combobox.label")}</Label>
            <Input
              autoFocus
              id="artist-request-name"
              maxLength={120}
              onChange={(event) => setRequestName(event.target.value)}
              value={requestName ?? ""}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setRequestName(null)} type="button" variant="outline">
              {t("products:create.actions.cancel")}
            </Button>
            <Button
              aria-busy={submitting}
              disabled={submitting || !requestName?.trim()}
              type="submit"
            >
              {t("artists:request.actions.submit")}
            </Button>
          </DialogFooter>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);
