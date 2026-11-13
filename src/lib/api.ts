// Typed client for the Rust commands in src-tauri/src/lib.rs.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

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
  /** More screenshots of the same message, after image_url in reading order. */
  extra_image_urls: string[];
  fields: Record<string, string> | null;
  report: string | null;
  error: string | null;
};

export type ReadyShot = Shot & {
  fields: Record<string, string>;
  report: string;
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function call<T>(
  command: string,
  args?: Parameters<typeof invoke>[1],
  options?: Parameters<typeof invoke>[2],
): Promise<T> {
  try {
    return await invoke<T>(command, args, options);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err)); // commands reject with a message string
  }
}

// Rust returns file paths; the webview loads them through Tauri's asset protocol.
const withUrls = (shot: Shot): Shot => ({
  ...shot,
  image_url: shot.image_url && convertFileSrc(shot.image_url),
  extra_image_urls: shot.extra_image_urls.map((path) => convertFileSrc(path)),
});

export const api = {
  folders: (sort: FolderSort, archived: boolean) =>
    call<Folder[]>("list_folders", { sort, archived }),
  archiveFolder: (id: number) =>
    call<Folder>("set_archived", { id, archived: true }),
  restoreFolder: (id: number) =>
    call<Folder>("set_archived", { id, archived: false }),
  createFolder: (name: string) => call<Folder>("create_folder", { name }),
  renameFolder: (id: number, name: string) =>
    call<Folder>("rename_folder", { id, name }),
  screenshots: async (folderId: number) =>
    (await call<Shot[]>("list_screenshots", { folderId })).map(withUrls),
  async upload(folderId: number, image: Blob, source: "upload" | "screen") {
    if (!image.type.startsWith("image/"))
      throw new Error("Please choose image files only");
    if (image.size > MAX_IMAGE_BYTES)
      throw new Error("Image must be at most 10 MB");
    const bytes = new Uint8Array(await image.arrayBuffer());
    return withUrls(
      await call<Shot>("add_screenshot", bytes, {
        headers: { "folder-id": String(folderId), source },
      }),
    );
  },
  addText: async (folderId: number, text: string) =>
    withUrls(await call<Shot>("add_text", { folderId, text })),
  combine: async (shotIds: number[]) =>
    withUrls(await call<Shot>("combine_screenshots", { ids: shotIds })),
  deleteShot: (shotId: number) =>
    call<null>("delete_screenshot", { id: shotId }),
  generate: async (shotId: number) =>
    withUrls(await call<Shot>("generate_report", { id: shotId })),
  /** Saves the folder's reports to the Downloads folder; resolves to the file path. */
  exportExcel: (folderId: number) =>
    call<string>("export_excel", { folderId }),
};

export const isReady = (shot: Shot): shot is ReadyShot =>
  !!shot.report && !!shot.fields;
export const isPending = (shot: Shot) => !shot.report && !shot.error;
