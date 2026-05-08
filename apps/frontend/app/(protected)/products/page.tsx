import { serverApi } from "../../../src/lib/server/api";
import { toSerializableApiError } from "../../../src/lib/server/api-error";
import { requireServerSession } from "../../../src/lib/server/auth";
import { type Product, ProductsPage } from "../../../src/views/ProductsPage";

export default async function Page() {
  const session = await requireServerSession();
  try {
    const res = await serverApi.get<{ items: Product[] }>("/products", {
      auth: { sessionCookie: session.sessionCookie },
    });
    return <ProductsPage initialProducts={res.items} />;
  } catch (error) {
    return <ProductsPage initialError={toSerializableApiError(error, "Unable to load products")} />;
  }
}
