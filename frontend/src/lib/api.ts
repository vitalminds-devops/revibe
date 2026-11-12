// Typed client for the FastAPI backend, reached through the /api rewrite in next.config.ts.

export type Folder = {
  id: number;
  name: string;
  created_at: string;
  archived: boolean;
  screenshots: number;
  reports: number;
  pending: number;
};

export type FolderSort = "newest" | "name";

export type Shot = {
  id: number;
  folder_id: number;
  source: "upload" | "screen" | "text";
  created_at: string;
  image_url: string | null;
  text: string | null;
  fields: Record<string, string> | null;
  report: string | null;
  error: string | null;
};

export type ReadyShot = Shot & {
  fields: Record<string, string>;
  report: string;
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const LIST_TIMEOUT_MS = 30_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch (err) {
    // A hung backend or database must end in an error, not an endless skeleton.
    if (err instanceof DOMException && err.name === "TimeoutError")
      throw new Error(
        "The backend didn't answer within 30 seconds. Check that it is running and can reach the database.",
      );
    throw err;
  }
  // Session expired or signed out in another tab: back to the login page.
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears signed-in state
    window.location.assign("/login");
    throw new Error("Please sign in again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${res.status})`,
    );
  return data;
}

function listSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(LIST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function sendName(method: "POST" | "PATCH", path: string, name: string) {
  return request<Folder>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export const api = {
  folders: (sort: FolderSort, archived: boolean, signal?: AbortSignal) =>
    request<Folder[]>(`/folders?sort=${sort}&archived=${archived}`, {
      signal: listSignal(signal),
    }),
  archiveFolder: (id: number) =>
    request<Folder>(`/folders/${id}/archive`, { method: "POST" }),
  restoreFolder: (id: number) =>
    request<Folder>(`/folders/${id}/restore`, { method: "POST" }),
  createFolder: (name: string) => sendName("POST", "/folders", name),
  renameFolder: (id: number, name: string) =>
    sendName("PATCH", `/folders/${id}`, name),
  screenshots: (folderId: number, signal?: AbortSignal) =>
    request<Shot[]>(`/folders/${folderId}/screenshots`, {
      signal: listSignal(signal),
    }),
  upload(folderId: number, image: Blob, source: "upload" | "screen") {
    if (!image.type.startsWith("image/"))
      throw new Error("Please choose image files only");
    if (image.size > MAX_IMAGE_BYTES)
      throw new Error("Image must be at most 10 MB");
    const body = new FormData();
    body.append(
      "image",
      image,
      image instanceof File ? image.name : "screen.png",
    );
    body.append("source", source);
    return request<Shot>(`/folders/${folderId}/screenshots`, {
      method: "POST",
      body,
    });
  },
  addText: (folderId: number, text: string) =>
    request<Shot>(`/folders/${folderId}/texts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  deleteShot: (shotId: number) =>
    request<null>(`/screenshots/${shotId}`, { method: "DELETE" }),
  generate: (shotId: number) =>
    request<Shot>(`/screenshots/${shotId}/report`, { method: "POST" }),
  exportUrl: (folderId: number) => `/api/folders/${folderId}/export.xlsx`,
};

export const isReady = (shot: Shot): shot is ReadyShot =>
  !!shot.report && !!shot.fields;
export const isPending = (shot: Shot) => !shot.report && !shot.error;
