export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  createdTime: string;
  modifiedTime: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  isFolder: boolean;
};

export type Crumb = { id: string; name: string };

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    return json.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchItems(
  folderId: string | null,
): Promise<{ items: DriveItem[]; breadcrumb: Crumb[] }> {
  const url = folderId ? `/api/folders/${folderId}/files` : "/api/files";
  const res = await fetch(url);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { items: DriveItem[]; breadcrumb?: Crumb[] };
  return { items: json.items, breadcrumb: json.breadcrumb ?? [] };
}

export async function createFolder(name: string, parentId: string | null): Promise<void> {
  const res = await fetch("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...(parentId ? { parentId } : {}) }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function renameItem(id: string, name: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function fetchFolders(): Promise<DriveItem[]> {
  const res = await fetch("/api/folders");
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { folders: DriveItem[] };
  return json.folders;
}

export async function moveItem(id: string, destinationId: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinationId }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}

export type ConfigStatus = {
  configured: boolean;
  authorized: boolean;
  authType: "service_account" | "oauth" | "none";
};

export async function fetchConfigured(): Promise<ConfigStatus> {
  const res = await fetch("/api/config");
  if (!res.ok) return { configured: false, authorized: false, authType: "none" };
  return (await res.json()) as ConfigStatus;
}

/** Uploads one file with progress via XHR (fetch has no upload progress). */
export function uploadFile(
  file: File,
  opts: { parentId: string | null; useDateFolder: boolean },
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    if (opts.parentId) form.append("parentId", opts.parentId);
    form.append("useDateFolder", String(opts.useDateFolder));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        /* keep default */
      }
      reject(new Error(message));
    };
    xhr.onerror = () =>
      reject(new Error("Network error during upload. Check your connection and try again."));
    xhr.send(form);
  });
}

export function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function kindOf(mime: string): string {
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "Spreadsheet";
  if (mime.includes("presentation")) return "Presentation";
  if (mime.includes("word") || mime.includes("document")) return "Document";
  if (mime.includes("zip") || mime.includes("compressed")) return "Archive";
  if (mime.startsWith("text/")) return "Text";
  return "File";
}
