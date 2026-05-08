"use client";

import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingSkeleton } from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import {
  AdminQueueTable,
  formatAdminQueueDate,
  QueueFilterSummary,
  RejectProductDialog,
  useAdminQueue,
  type AdminQueuePageProps,
  type AdminQueueProduct,
} from "../features/admin/queue";

export type { AdminQueueProduct };

export const AdminQueuePage = ({
  initialError = null,
  initialItems = null,
}: AdminQueuePageProps = {}) => {
  const { i18n, t } = useTranslation(["admin", "products"]);
  const queue = useAdminQueue({ initialError, initialItems });

  const pendingCount = queue.items?.length ?? 0;
  const formatCreatedAt = (value: string) => formatAdminQueueDate(value, i18n.language);

  return (
    <>
      <PageHeader title={t("admin:queue.title")} description={t("admin:queue.subtitle")} />
      <QueueFilterSummary pendingCount={pendingCount} />
      {queue.error && (
        <ErrorState className="mb-4">
          {queue.error.code}: {queue.error.message}
        </ErrorState>
      )}
      {!queue.items && !queue.error && (
        <LoadingSkeleton label={t("admin:queue.loading")} shape="row" />
      )}
      {queue.items && queue.items.length === 0 && (
        <EmptyState
          description={t("admin:queue.empty.body")}
          title={t("admin:queue.empty.title")}
        />
      )}
      {queue.items && queue.items.length > 0 && (
        <AdminQueueTable
          actionId={queue.actionId}
          formatCreatedAt={formatCreatedAt}
          items={queue.items}
          onApprove={(id) => void queue.approve(id)}
          onReject={queue.openRejectDialog}
        />
      )}
      <RejectProductDialog
        actionId={queue.actionId}
        onClose={queue.closeRejectDialog}
        onConfirm={(product) => void queue.confirmReject(product)}
        product={queue.rejectProduct}
        reason={queue.rejectReason}
        setReason={queue.setRejectReason}
      />
    </>
  );
};
