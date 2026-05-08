import { serverApi } from "../../../../src/lib/server/api";
import { toSerializableApiError } from "../../../../src/lib/server/api-error";
import { requireServerRole } from "../../../../src/lib/server/auth";
import { type Artist, ArtistsPage } from "../../../../src/views/admin/ArtistsPage";

export default async function Page() {
  const session = await requireServerRole("admin");
  try {
    const res = await serverApi.get<{ items: Artist[] }>("/artists?status=published", {
      auth: { sessionCookie: session.sessionCookie },
    });
    return <ArtistsPage initialItems={res.items} />;
  } catch (error) {
    return <ArtistsPage initialError={toSerializableApiError(error, "Unable to load artists")} />;
  }
}
