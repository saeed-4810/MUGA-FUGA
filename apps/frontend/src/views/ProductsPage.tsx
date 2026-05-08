"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MediaThumbnail,
  StatusPill,
} from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import type { ApiError } from "../lib/api";

export interface Product {
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

interface ProductsPageProps {
  initialError?: ApiError | null;
  initialProducts?: Product[] | null;
}

const getArtistInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "♪";

const ProductCard = ({ product }: { product: Product }) => {
  const { t } = useTranslation("products");
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
      <MediaThumbnail
        alt={t("list.coverAlt", { name: product.name })}
        className="aspect-square"
        fallbackLabel={t("list.coverFallback")}
        {...(product.coverArtUrl ? { src: product.coverArtUrl } : {})}
      />
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-card-foreground text-lg font-semibold leading-tight">
            {product.name}
          </h2>
          <StatusPill tone={product.status}>{statusLabel}</StatusPill>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <Avatar className="border-border h-8 w-8 border">
            {product.artist.imageUrl ? <AvatarImage src={product.artist.imageUrl} alt="" /> : null}
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

export const ProductsPage = ({
  initialError = null,
  initialProducts = null,
}: ProductsPageProps = {}) => {
  const { t } = useTranslation("products");
  const products = initialProducts;
  const error = initialError;

  return (
    <>
      <PageHeader
        title={t("list.title")}
        description={t("list.subtitle")}
        action={
          <Button asChild size="sm">
            <Link href="/products/new">{t("list.actions.create")}</Link>
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
              <Link href="/products/new">{t("list.actions.create")}</Link>
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
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
