import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server/auth";
import { LoginPage } from "@/views/LoginPage";

export default async function Page() {
  const session = await getServerSession();
  if (session) redirect("/");
  return <LoginPage />;
}
