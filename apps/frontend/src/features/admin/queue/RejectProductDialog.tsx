import { useTranslation } from "react-i18next";

import type { AdminQueueProduct } from "./types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RejectProductDialogProps {
  actionId: string | null;
  onClose: () => void;
  onConfirm: (product: AdminQueueProduct) => void;
  product: AdminQueueProduct | null;
  reason: string;
  setReason: (reason: string) => void;
}

export const RejectProductDialog = ({
  actionId,
  onClose,
  onConfirm,
  product,
  reason,
  setReason,
}: RejectProductDialogProps) => {
  const { t } = useTranslation("admin");

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("queue.reject.title", { name: product?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("queue.reject.body")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">{t("queue.reject.reason")}</Label>
          <Input
            id="reject-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("queue.reject.placeholder")}
            value={reason}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("queue.reject.cancel")}</Button>
          </DialogClose>
          <Button
            disabled={Boolean(product && actionId === product.id)}
            onClick={() => product && onConfirm(product)}
            variant="destructive"
          >
            {t("queue.reject.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
