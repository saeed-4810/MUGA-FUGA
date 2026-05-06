import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

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
  coverArtPath: string;
  coverArtUrl?: string;
  status: "pending" | "published" | "rejected";
  ownerEmail: string;
  createdAt: string;
}

export const ProductsPage = () => {
  const { t } = useTranslation("products");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api
      .get<{ items: Product[] }>("/products")
      .then((r) => setProducts(r.items))
      .catch((e) => setError(e as ApiError));
  }, []);

  return (
    <RequireAuth>
      <PageHeader
        title={t("list.title")}
        description={t("list.subtitle")}
        action={
          <Link to="/products/new" className="btn-primary h-9">
            {t("list.actions.create")}
          </Link>
        }
      />
      {error && (
        <ErrorState className="mb-4">{t("list.errors.load", { code: error.code })}</ErrorState>
      )}
      {!products && !error && <LoadingSkeleton count={6} grid label={t("list.loading")} />}
      {products && products.length === 0 && (
        <EmptyState
          action={
            <Link to="/products/new" className="btn-primary">
              {t("list.actions.create")}
            </Link>
          }
          description={t("list.empty.body")}
          title={t("list.empty.title")}
        />
      )}
      {products && products.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="product-grid">
          {products.map((p) => (
            <li key={p.id} className="card hover:shadow-glow overflow-hidden transition">
              <div className="bg-surface-muted aspect-square">
                {p.coverArtUrl ? (
                  <img
                    src={p.coverArtUrl}
                    alt={t("list.coverAlt", { name: p.name })}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-ink-subtle grid h-full place-items-center">♪</div>
                )}
              </div>
              <div className="p-4">
                <div className="text-base font-semibold">{p.name}</div>
                <div className="text-ink-muted mt-2 flex items-center gap-2 text-sm">
                  {p.artist.imageUrl ? (
                    <img
                      src={p.artist.imageUrl}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="bg-surface-muted text-ink-subtle grid h-6 w-6 place-items-center rounded-full text-xs">
                      ♪
                    </span>
                  )}
                  <span>{p.artist.name}</span>
                </div>
                <div className="text-ink-subtle mt-2 text-xs uppercase tracking-wider">
                  {t(`status.${p.status}`)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </RequireAuth>
  );
};
