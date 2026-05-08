import { useCallback, useState } from "react";

import type { AdminQueuePageProps, AdminQueueProduct } from "./types";

import { api, type ApiError } from "@/lib/api";

export const useAdminQueue = ({
  initialError = null,
  initialItems = null,
}: AdminQueuePageProps) => {
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
      .then((response) => setItems(response.items))
      .catch((queueError) => setError(queueError as ApiError));
  }, []);

  const approve = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await api.post(`/products/${id}/approve`, {});
      reload();
    } catch (queueError) {
      setError(queueError as ApiError);
    } finally {
      setActionId(null);
    }
  };

  const openRejectDialog = (product: AdminQueueProduct) => {
    setRejectProduct(product);
    setRejectReason("");
  };

  const closeRejectDialog = () => setRejectProduct(null);

  const confirmReject = async (product: AdminQueueProduct) => {
    setActionId(product.id);
    setError(null);
    try {
      const reason = rejectReason.trim();
      await api.post(`/products/${product.id}/reject`, reason ? { reason } : {});
      setRejectProduct(null);
      setRejectReason("");
      reload();
    } catch (queueError) {
      setError(queueError as ApiError);
    } finally {
      setActionId(null);
    }
  };

  return {
    actionId,
    approve,
    closeRejectDialog,
    confirmReject,
    error,
    items,
    openRejectDialog,
    rejectProduct,
    rejectReason,
    setRejectReason,
  };
};
