"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

type PendingItemsResponse = {
  items: unknown[];
};

export function usePendingReviewCount(enabled: boolean, initialCount: number) {
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    void Promise.all([
      api.get<PendingItemsResponse>("/products?status=pending"),
      api.get<PendingItemsResponse>("/artists?status=pending"),
    ])
      .then(([products, artists]) => setCount(products.items.length + artists.items.length))
      .catch(() => setCount(initialCount));
  }, [enabled, initialCount]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;

    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, refresh]);

  return count;
}
