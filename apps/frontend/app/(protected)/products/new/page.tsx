import type { ArtistOption } from "../../../../src/components/ArtistCombobox";
import { serverApi } from "../../../../src/lib/server/api";
import { requireServerSession } from "../../../../src/lib/server/auth";
import { CreateProductPage } from "../../../../src/views/CreateProductPage";

export default async function Page() {
  const session = await requireServerSession();
  const artists = await serverApi
    .get<{ items: ArtistOption[] }>("/artists?status=published", {
      auth: { sessionCookie: session.sessionCookie },
    })
    .then((res) => res.items)
    .catch(() => []);
  return <CreateProductPage initialArtistOptions={artists} />;
}
