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
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProductDetailsDialogProps {
  formatCreatedAt: (value: string) => string;
  product: AdminQueueProduct;
}

export const ProductDetailsDialog = ({ formatCreatedAt, product }: ProductDetailsDialogProps) => {
  const { t } = useTranslation(["admin", "products"]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("admin:queue.actions.details")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin:queue.details.title", { name: product.name })}</DialogTitle>
          <DialogDescription>{t("admin:queue.details.body")}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("products:list.columns.artist")}</dt>
            <dd className="font-medium">{product.artist.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("admin:queue.columns.owner")}</dt>
            <dd className="font-medium">{product.ownerEmail}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("admin:queue.columns.created")}</dt>
            <dd className="font-medium">{formatCreatedAt(product.createdAt)}</dd>
          </div>
        </dl>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("admin:queue.details.close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
