import { redirect } from "next/navigation";

import { getServerSession } from "../../../src/lib/server/auth";
import { LoginPage } from "../../../src/views/LoginPage";

export default async function Page() {
  const session = await getServerSession();
  if (session) redirect("/");
  return <LoginPage />;
}
