import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, LoadingSkeleton } from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import { RequireAuth } from "../components/RequireAuth";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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

const statusTone: Record<Product["status"], string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

const getArtistInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "♪";

interface ProductCardProps {
  product: Product;
  t: TFunction<"products">;
}

const ProductCard = ({ product, t }: ProductCardProps) => {
  const statusLabel = t(`status.${product.status}`);

  return (
    <Card
      aria-label={t("list.cardLabel", {
        artist: product.artist.name,
        name: product.name,
        status: statusLabel,
      })}
      className="hover:shadow-glow group overflow-hidden transition duration-200 hover:-translate-y-0.5"
    >
      <div className="bg-muted text-muted-foreground aspect-square overflow-hidden">
        {product.coverArtUrl ? (
          <img
            src={product.coverArtUrl}
            alt={t("list.coverAlt", { name: product.name })}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div
            aria-label={t("list.coverFallback")}
            className="grid h-full place-items-center text-4xl"
            role="img"
          >
            ♪
          </div>
        )}
      </div>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-card-foreground text-lg font-semibold leading-tight">
            {product.name}
          </h2>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wider ${statusTone[product.status]}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <Avatar className="border-border h-8 w-8 border">
            {product.artist.imageUrl && <AvatarImage src={product.artist.imageUrl} alt="" />}
            <AvatarFallback className="text-xs font-semibold">
              {getArtistInitial(product.artist.name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate">{product.artist.name}</span>
        </div>
      </CardContent>
    </Card>
  );
};

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
          <Button asChild size="sm">
            <Link to="/products/new">{t("list.actions.create")}</Link>
          </Button>
        }
      />
      {error && (
        <ErrorState className="mb-4">{t("list.errors.load", { code: error.code })}</ErrorState>
      )}
      {!products && !error && <LoadingSkeleton count={6} grid label={t("list.loading")} />}
      {products && products.length === 0 && (
        <EmptyState
          action={
            <Button asChild>
              <Link to="/products/new">{t("list.actions.create")}</Link>
            </Button>
          }
          description={t("list.empty.body")}
          title={t("list.empty.title")}
        />
      )}
      {products && products.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="product-grid">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} t={t} />
            </li>
          ))}
        </ul>
      )}
    </RequireAuth>
  );
};
