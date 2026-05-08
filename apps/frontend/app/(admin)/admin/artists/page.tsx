import { serverApi } from "@/lib/server/api";
import { toSerializableApiError } from "@/lib/server/api-error";
import { requireServerRole } from "@/lib/server/auth";
import { type Artist, ArtistsPage } from "@/views/admin/ArtistsPage";

export default async function Page() {
  const session = await requireServerRole("admin");
  try {
    const res = await serverApi.get<{ items: Artist[] }>("/artists?status=published", {
      auth: { sessionCookie: session.sessionCookie },
    });
    return <ArtistsPage initialItems={res.items} />;
  } catch (error) {
    return <ArtistsPage initialError={toSerializableApiError(error, "ADMIN_ARTISTS_LOAD_FAILED")} />;
  }
}
