import { serverApi } from "./api";

export const loadPendingReviewCount = async (
  sessionCookie: string,
  isAdmin: boolean
): Promise<number> => {
  if (!isAdmin) return 0;
  try {
    const [products, artists] = await Promise.all([
      serverApi.get<{ items: unknown[] }>("/products?status=pending", {
        auth: { sessionCookie },
      }),
      serverApi.get<{ items: unknown[] }>("/artists?status=pending", {
        auth: { sessionCookie },
      }),
    ]);
    return products.items.length + artists.items.length;
  } catch {
    return 0;
  }
};
