import { useTranslation } from "react-i18next";

import { ProductDetailsDialog } from "./ProductDetailsDialog";
import type { AdminQueueProduct } from "./types";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminQueueTableProps {
  actionId: string | null;
  formatCreatedAt: (value: string) => string;
  items: AdminQueueProduct[];
  onApprove: (id: string) => void;
  onReject: (product: AdminQueueProduct) => void;
}

export const AdminQueueTable = ({
  actionId,
  formatCreatedAt,
  items,
  onApprove,
  onReject,
}: AdminQueueTableProps) => {
  const { t } = useTranslation(["admin", "products"]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border border-b p-4">
        <CardTitle className="text-base">{t("admin:queue.tableTitle")}</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead>{t("products:list.columns.name")}</TableHead>
            <TableHead>{t("products:list.columns.artist")}</TableHead>
            <TableHead>{t("admin:queue.columns.owner")}</TableHead>
            <TableHead>{t("admin:queue.columns.created")}</TableHead>
            <TableHead className="text-right">{t("admin:queue.columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">{product.artist.name}</TableCell>
              <TableCell className="text-muted-foreground">{product.ownerEmail}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatCreatedAt(product.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <ProductDetailsDialog formatCreatedAt={formatCreatedAt} product={product} />
                  <Button
                    disabled={actionId === product.id}
                    onClick={() => onReject(product)}
                    size="sm"
                    variant="outline"
                  >
                    {t("admin:queue.actions.reject")}
                  </Button>
                  <Button
                    disabled={actionId === product.id}
                    onClick={() => onApprove(product.id)}
                    size="sm"
                  >
                    {t("admin:queue.actions.approve")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
