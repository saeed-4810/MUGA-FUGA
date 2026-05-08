import Link from "next/link";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import type { Artist, DeleteBlockDetails } from "./types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DeleteArtistDialogProps {
  artist: Artist;
  block: DeleteBlockDetails | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

export const trapContainerTabs = (event: KeyboardEvent, container: HTMLElement | null) => {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input, textarea, select"
    )
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

export const DeleteArtistDialog = ({
  artist,
  block,
  onClose,
  onConfirm,
}: DeleteArtistDialogProps) => {
  const { t } = useTranslation("admin");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ids = block?.blockingProductIds ?? [];

  useEffect(() => {
    cancelRef.current?.focus();
  }, [block]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          trapContainerTabs(event, dialogRef.current);
        }}
        ref={dialogRef}
        className="w-full max-w-lg p-6"
      >
        <h2 id={titleId} className="text-xl font-bold">
          {block ? t("artists.delete.blockedTitle") : t("artists.delete.title")}
        </h2>
        <p className="text-ink-muted mt-2 text-sm">
          {block
            ? t("artists.delete.blockedBody", { count: ids.length })
            : t("artists.delete.body", { name: artist.name })}
        </p>
        {ids.length > 0 ? (
          <ul className="divide-line border-line mt-4 divide-y rounded-xl border">
            {ids.map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>{id}</span>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/products?productId=${encodeURIComponent(id)}`}>
                    {t("artists.delete.reassign")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {block?.hasMore ? (
          <p className="text-ink-subtle mt-2 text-xs">{t("artists.delete.hasMore")}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onClose}>
            {t("artists.delete.cancel")}
          </Button>
          {!block ? (
            <Button type="button" onClick={onConfirm}>
              {t("artists.delete.confirm")}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
