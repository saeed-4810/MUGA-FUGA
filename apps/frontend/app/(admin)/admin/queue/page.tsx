import { serverApi } from "../../../../src/lib/server/api";
import { toSerializableApiError } from "../../../../src/lib/server/api-error";
import { requireServerRole } from "../../../../src/lib/server/auth";
import { AdminQueuePage, type AdminQueueProduct } from "../../../../src/views/AdminQueuePage";

export default async function Page() {
  const session = await requireServerRole("admin");
  try {
    const res = await serverApi.get<{ items: AdminQueueProduct[] }>("/products?status=pending", {
      auth: { sessionCookie: session.sessionCookie },
    });
    return <AdminQueuePage initialItems={res.items} />;
  } catch (error) {
    return <AdminQueuePage initialError={toSerializableApiError(error, "Unable to load queue")} />;
  }
}
