"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingSkeleton } from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { api, type ApiError } from "../lib/api";

export interface AdminQueueProduct {
  id: string;
  name: string;
  artist: {
    id: string;
    name: string;
    status: "pending" | "published" | "rejected";
    imageUrl?: string;
  };
  ownerEmail: string;
  createdAt: string;
  status: "pending" | "published" | "rejected";
}

interface AdminQueuePageProps {
  initialError?: ApiError | null;
  initialItems?: AdminQueueProduct[] | null;
}

export const AdminQueuePage = ({
  initialError = null,
  initialItems = null,
}: AdminQueuePageProps = {}) => {
  const { i18n, t } = useTranslation(["admin", "products"]);
  const [items, setItems] = useState<AdminQueueProduct[] | null>(initialItems);
  const [error, setError] = useState<ApiError | null>(initialError);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectProduct, setRejectProduct] = useState<AdminQueueProduct | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reload = useCallback(() => {
    setError(null);
    setItems(null);
    api
      .get<{ items: AdminQueueProduct[] }>("/products?status=pending")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e as ApiError));
  }, []);

  const approve = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await api.post(`/products/${id}/approve`, {});
      reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setActionId(null);
    }
  };

  const confirmReject = async (product: AdminQueueProduct) => {
    setActionId(product.id);
    setError(null);
    try {
      const reason = rejectReason.trim();
      await api.post(`/products/${product.id}/reject`, reason ? { reason } : {});
      setRejectProduct(null);
      setRejectReason("");
      reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = items?.length ?? 0;
  const formatCreatedAt = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value)
    );

  return (
    <>
      <PageHeader title={t("admin:queue.title")} description={t("admin:queue.subtitle")} />
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">{t("admin:queue.filters.status")}</div>
            <p className="text-muted-foreground text-sm">{t("admin:queue.filters.description")}</p>
          </div>
          <div role="group" aria-label={t("admin:queue.filters.status")}>
            <Button aria-pressed="true" variant="secondary">
              {t("admin:queue.status.pending", { count: pendingCount })}
            </Button>
          </div>
        </CardContent>
      </Card>
      {error && (
        <ErrorState className="mb-4">
          {error.code}: {error.message}
        </ErrorState>
      )}
      {!items && !error && <LoadingSkeleton label={t("admin:queue.loading")} shape="row" />}
      {items && items.length === 0 && (
        <EmptyState
          description={t("admin:queue.empty.body")}
          title={t("admin:queue.empty.title")}
        />
      )}
      {items && items.length > 0 && (
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
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.artist.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.ownerEmail}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCreatedAt(p.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            {t("admin:queue.actions.details")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {t("admin:queue.details.title", { name: p.name })}
                            </DialogTitle>
                            <DialogDescription>{t("admin:queue.details.body")}</DialogDescription>
                          </DialogHeader>
                          <dl className="grid gap-3 text-sm">
                            <div>
                              <dt className="text-muted-foreground">
                                {t("products:list.columns.artist")}
                              </dt>
                              <dd className="font-medium">{p.artist.name}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                {t("admin:queue.columns.owner")}
                              </dt>
                              <dd className="font-medium">{p.ownerEmail}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                {t("admin:queue.columns.created")}
                              </dt>
                              <dd className="font-medium">{formatCreatedAt(p.createdAt)}</dd>
                            </div>
                          </dl>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">{t("admin:queue.details.close")}</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        disabled={actionId === p.id}
                        onClick={() => {
                          setRejectProduct(p);
                          setRejectReason("");
                        }}
                        size="sm"
                        variant="outline"
                      >
                        {t("admin:queue.actions.reject")}
                      </Button>
                      <Button
                        disabled={actionId === p.id}
                        onClick={() => void approve(p.id)}
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
      )}
      <Dialog
        open={Boolean(rejectProduct)}
        onOpenChange={(open) => !open && setRejectProduct(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin:queue.reject.title", { name: rejectProduct?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("admin:queue.reject.body")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t("admin:queue.reject.reason")}</Label>
            <Input
              id="reject-reason"
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t("admin:queue.reject.placeholder")}
              value={rejectReason}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("admin:queue.reject.cancel")}</Button>
            </DialogClose>
            <Button
              disabled={Boolean(rejectProduct && actionId === rejectProduct.id)}
              onClick={() => rejectProduct && void confirmReject(rejectProduct)}
              variant="destructive"
            >
              {t("admin:queue.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
