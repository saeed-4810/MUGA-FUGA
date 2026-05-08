import { serverApi } from "@/lib/server/api";
import { toSerializableApiError } from "@/lib/server/api-error";
import { requireServerSession } from "@/lib/server/auth";
import { type Product, ProductsPage } from "@/views/ProductsPage";

export default async function Page() {
  const session = await requireServerSession();
  try {
    const res = await serverApi.get<{ items: Product[] }>("/products", {
      auth: { sessionCookie: session.sessionCookie },
    });
    return <ProductsPage initialProducts={res.items} />;
  } catch (error) {
    return <ProductsPage initialError={toSerializableApiError(error, "PRODUCTS_LOAD_FAILED")} />;
  }
}
