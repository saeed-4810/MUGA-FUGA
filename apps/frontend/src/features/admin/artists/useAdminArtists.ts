import { useCallback, useEffect, useRef, useState } from "react";

import { isDeleteBlockDetails } from "./artist-form";
import type {
  Artist,
  ArtistsPageProps,
  ArtistStatus,
  DeleteBlockDetails,
  EditingArtist,
} from "./types";

import { api, type ApiError } from "@/lib/api";

export const useAdminArtists = ({
  initialError = null,
  initialItems = null,
  initialStatus = "published",
}: ArtistsPageProps) => {
  const [status, setStatus] = useState<ArtistStatus>(initialStatus);
  const [items, setItems] = useState<Artist[] | null>(initialItems);
  const [error, setError] = useState<ApiError | null>(initialError);
  const [editing, setEditing] = useState<EditingArtist>(null);
  const [deleting, setDeleting] = useState<Artist | null>(null);
  const [rejecting, setRejecting] = useState<Artist | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteBlock, setDeleteBlock] = useState<DeleteBlockDetails | undefined>();
  const didSkipInitialStatusLoad = useRef(false);

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    api
      .get<{ items: Artist[] }>(`/artists?status=${status}`)
      .then((response) => setItems(response.items))
      .catch((artistsError) => setError(artistsError as ApiError));
  }, [status]);

  useEffect(() => {
    if (!didSkipInitialStatusLoad.current && status === initialStatus) {
      didSkipInitialStatusLoad.current = true;
      return;
    }
    load();
  }, [initialStatus, load, status]);

  const openCreateEditor = () => setEditing("new");
  const openEditEditor = (artist: Artist) => setEditing(artist);
  const closeEditor = () => setEditing(null);

  const openDeleteDialog = (artist: Artist) => {
    setDeleting(artist);
    setDeleteBlock(undefined);
  };

  const closeDeleteDialog = () => {
    setDeleting(null);
    setDeleteBlock(undefined);
  };

  const openRejectDialog = (artist: Artist) => {
    setRejecting(artist);
    setRejectReason("");
  };

  const closeRejectDialog = () => setRejecting(null);

  const approve = async (id: string) => {
    try {
      await api.post(`/artists/${id}/approve`, {});
      load();
    } catch (approveError) {
      setError(approveError as ApiError);
    }
  };

  const reject = async (artist: Artist) => {
    try {
      const reason = rejectReason.trim();
      await api.post(`/artists/${artist.id}/reject`, reason ? { reason } : {});
      setRejecting(null);
      setRejectReason("");
      load();
    } catch (rejectError) {
      setError(rejectError as ApiError);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/artists/${deleting.id}`);
      closeDeleteDialog();
      load();
    } catch (deleteError) {
      const apiError = deleteError as ApiError;
      if (apiError.status === 409 && isDeleteBlockDetails(apiError.details)) {
        setDeleteBlock(apiError.details);
        return;
      }
      setError(apiError);
      setDeleting(null);
    }
  };

  return {
    approve,
    closeDeleteDialog,
    closeEditor,
    closeRejectDialog,
    confirmDelete,
    deleteBlock,
    deleting,
    editing,
    error,
    items,
    load,
    openCreateEditor,
    openDeleteDialog,
    openEditEditor,
    openRejectDialog,
    reject,
    rejecting,
    rejectReason,
    setRejectReason,
    setStatus,
    status,
  };
};

export const getArtistEmptyCopy = (status: ArtistStatus, t: (key: string) => string) => ({
  title: t(`artists.empty.${status}.title`),
  body: t(`artists.empty.${status}.body`),
});
