import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

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
        <div role="alert" className="card mb-4 border-red-500/40 bg-red-500/10 p-4 text-sm">
          {t("list.errors.load", { code: error.code })}
        </div>
      )}
      {!products && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-56 animate-pulse" aria-busy="true" />
          ))}
        </div>
      )}
      {products && products.length === 0 && (
        <div className="card p-10 text-center">
          <h2 className="text-lg font-semibold">{t("list.empty.title")}</h2>
          <p className="text-ink-muted mt-2 text-sm">{t("list.empty.body")}</p>
          <Link to="/products/new" className="btn-primary mt-4 inline-flex">
            {t("list.actions.create")}
          </Link>
        </div>
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
