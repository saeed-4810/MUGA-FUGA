import type { ArtistOption } from "@/components/ArtistCombobox";
import { serverApi } from "@/lib/server/api";
import { requireServerSession } from "@/lib/server/auth";
import { CreateProductPage } from "@/views/CreateProductPage";

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
