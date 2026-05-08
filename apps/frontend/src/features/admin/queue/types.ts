import type { ApiError } from "@/lib/api";

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

export interface AdminQueuePageProps {
  initialError?: ApiError | null;
  initialItems?: AdminQueueProduct[] | null;
}
