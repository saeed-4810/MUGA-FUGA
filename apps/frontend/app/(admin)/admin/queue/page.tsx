import { serverApi } from "@/lib/server/api";
import { toSerializableApiError } from "@/lib/server/api-error";
import { requireServerRole } from "@/lib/server/auth";
import { AdminQueuePage, type AdminQueueProduct } from "@/views/AdminQueuePage";

export default async function Page() {
  const session = await requireServerRole("admin");
  try {
    const res = await serverApi.get<{ items: AdminQueueProduct[] }>("/products?status=pending", {
      auth: { sessionCookie: session.sessionCookie },
    });
    return <AdminQueuePage initialItems={res.items} />;
  } catch (error) {
    return <AdminQueuePage initialError={toSerializableApiError(error, "ADMIN_QUEUE_LOAD_FAILED")} />;
  }
}
