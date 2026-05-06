import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingSkeleton } from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import { RequireAuth } from "../components/RequireAuth";
import { api, type ApiError } from "../lib/api";

interface Product {
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

export const AdminQueuePage = () => {
  const { t } = useTranslation(["admin", "products"]);
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(() => {
    setItems(null);
    api
      .get<{ items: Product[] }>("/products?status=pending")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e as ApiError));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const approve = async (id: string) => {
    await api.post(`/products/${id}/approve`, {});
    reload();
  };
  const reject = async (id: string) => {
    const reason = window.prompt(t("admin:reject.promptReason")) ?? undefined;
    await api.post(`/products/${id}/reject`, reason ? { reason } : {});
    reload();
  };

  return (
    <RequireAuth role="admin">
      <PageHeader title={t("admin:queue.title")} description={t("admin:queue.subtitle")} />
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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-ink-subtle text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">{t("products:list.columns.name")}</th>
                <th className="px-4 py-3">{t("products:list.columns.artist")}</th>
                <th className="px-4 py-3">{t("admin:queue.columns.owner")}</th>
                <th className="px-4 py-3">{t("admin:queue.columns.created")}</th>
                <th className="px-4 py-3 text-right">{t("admin:queue.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="text-ink-muted px-4 py-3">{p.artist.name}</td>
                  <td className="text-ink-muted px-4 py-3">{p.ownerEmail}</td>
                  <td className="text-ink-subtle px-4 py-3">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost h-8" onClick={() => void reject(p.id)}>
                        {t("admin:queue.actions.reject")}
                      </button>
                      <button className="btn-primary h-8" onClick={() => void approve(p.id)}>
                        {t("admin:queue.actions.approve")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RequireAuth>
  );
};
