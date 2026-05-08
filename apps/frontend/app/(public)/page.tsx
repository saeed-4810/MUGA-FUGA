import { AppShell } from "@/components/AppShell";
import { serverApi } from "@/lib/server/api";
import { getServerSession } from "@/lib/server/auth";
import { loadPendingReviewCount } from "@/lib/server/pending-review";
import { DashboardPage, type ArtistRequest } from "@/views/DashboardPage";

export default async function Page() {
  const session = await getServerSession();
  const pendingReviewCount = await loadPendingReviewCount(
    session?.sessionCookie ?? "",
    session?.user.role === "admin"
  );
  const requests = session
    ? await serverApi
        .get<{ items: ArtistRequest[] }>(`/artists?ownerUid=${encodeURIComponent(session.user.uid)}`, {
          auth: { sessionCookie: session.sessionCookie },
        })
        .then((res) => res.items)
        .catch(() => [])
    : null;

  return (
    <AppShell initialPendingReviewCount={pendingReviewCount}>
      <DashboardPage initialRequests={requests} />
    </AppShell>
  );
}
