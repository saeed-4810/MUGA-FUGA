import { withWatchdog } from "./alerting";
import { api } from "./api";

export interface SignedUploadResponse {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
}

export async function requestSignedUpload(file: File): Promise<SignedUploadResponse> {
  return api.post<SignedUploadResponse>("/products/signed-upload", {
    contentType: file.type,
    fileSize: file.size,
  });
}

export async function uploadCoverArt(file: File): Promise<string> {
  return withWatchdog("uploadCoverArt", async () => {
    const { uploadUrl, objectPath } = await requestSignedUpload(file);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Upload failed (status ${res.status})`);
    }
    return objectPath;
  });
}

export async function requestSignedArtistImageUpload(file: File): Promise<SignedUploadResponse> {
  return api.post<SignedUploadResponse>("/artists/signed-upload", {
    contentType: file.type,
    fileSize: file.size,
  });
}

export async function uploadArtistImage(file: File): Promise<string> {
  return withWatchdog("uploadArtistImage", async () => {
    const { uploadUrl, objectPath } = await requestSignedArtistImageUpload(file);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Upload failed (status ${res.status})`);
    }
    return objectPath;
  });
}
