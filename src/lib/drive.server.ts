/**
 * Google Drive access library.
 * Supports both Google OAuth2 client and Service Account.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_ROOT_ID = "root";
const OAUTH_COOKIE = "drive_oauth_session";
const OAUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type DriveConfig = {
  clientEmail?: string;
  privateKey?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  rootFolderId: string;
  authType: "service_account" | "oauth" | "none";
};

export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
};

const refreshedTokens = new WeakMap<Request, OAuthTokens>();

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie") ?? "";
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      return name ? [[name, value]] : [];
    }),
  );
}

export function getStoredTokens(request: Request): OAuthTokens | null {
  const value = parseCookies(request)[OAUTH_COOKIE];
  if (!value) return null;
  try {
    const tokens = JSON.parse(decodeURIComponent(value)) as OAuthTokens;
    return tokens.access_token && tokens.refresh_token ? tokens : null;
  } catch {
    return null;
  }
}

export function oauthCookieHeader(tokens: OAuthTokens, clear = false): string {
  const value = clear ? "" : encodeURIComponent(JSON.stringify(tokens));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OAUTH_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : OAUTH_COOKIE_MAX_AGE}${secure}`;
}

export function applyOAuthCookie(response: Response, request: Request): Response {
  const tokens = refreshedTokens.get(request);
  if (!tokens) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", oauthCookieHeader(tokens));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function readConfig(): DriveConfig {
  const clientEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const rawKey = process.env["GOOGLE_PRIVATE_KEY"];
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const redirectUri = process.env["GOOGLE_REDIRECT_URI"];
  const rootFolderId = process.env["GOOGLE_DRIVE_FOLDER_ID"];

  if (clientEmail && rawKey) {
    return {
      clientEmail,
      privateKey: rawKey.replace(/\\n/g, "\n").trim(),
      rootFolderId: rootFolderId || DRIVE_ROOT_ID,
      authType: "service_account",
    };
  } else if (clientId && clientSecret) {
    return {
      clientId,
      clientSecret,
      redirectUri,
      rootFolderId: rootFolderId || DRIVE_ROOT_ID,
      authType: "oauth",
    };
  }

  return {
    rootFolderId: rootFolderId || DRIVE_ROOT_ID,
    authType: "none",
  };
}

export function getOAuthRedirectUri(config: DriveConfig): string {
  const redirectUri = config.redirectUri?.trim();
  if (!redirectUri && process.env.NODE_ENV !== "production") {
    return "http://localhost:8080/auth/google/callback";
  }
  if (!redirectUri) {
    throw new DriveError(
      "Missing configuration: GOOGLE_REDIRECT_URI. Set it to the exact callback URI registered in Google Cloud Console.",
      503,
    );
  }
  return redirectUri;
}

export function isConfigured(): boolean {
  try {
    const config = readConfig();
    return config.authType !== "none";
  } catch {
    return false;
  }
}

export function isAuthorized(request?: Request): boolean {
  try {
    const config = readConfig();
    if (config.authType === "service_account") return true;
    if (config.authType === "oauth") {
      const tokens = request ? getStoredTokens(request) : null;
      return !!(tokens && tokens.access_token);
    }
    return false;
  } catch {
    return false;
  }
}

/* ---------------------------------- auth --------------------------------- */

function base64url(bytes: Uint8Array | string): string {
  const str =
    typeof bytes === "string"
      ? bytes
      : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new DriveError("GOOGLE_PRIVATE_KEY is not a valid PEM private key.", 503);
  const binary = atob(body);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function refreshOAuthToken(
  request: Request,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  const updatedTokens: OAuthTokens = {
    access_token: json.access_token,
    refresh_token: refreshToken,
    expiry_date: Date.now() + json.expires_in * 1000,
  };
  if (json.refresh_token) {
    updatedTokens.refresh_token = json.refresh_token;
  }
  refreshedTokens.set(request, updatedTokens);
  return json.access_token;
}

export async function getAccessToken(request?: Request): Promise<string> {
  const config = readConfig();

  if (config.authType === "service_account") {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token;

    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: config.clientEmail,
        scope: SCOPE,
        aud: TOKEN_URL,
        exp: now + 3600,
        iat: now,
      }),
    );
    const signingInput = `${header}.${claims}`;

    let key: CryptoKey;
    try {
      key = await crypto.subtle.importKey(
        "pkcs8",
        pemToPkcs8(config.privateKey!),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
      );
    } catch {
      throw new DriveError(
        "Invalid GOOGLE_PRIVATE_KEY. Copy the full private_key value from the service account JSON.",
        503,
      );
    }

    const signature = new Uint8Array(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(signingInput),
      ),
    );
    const assertion = `${signingInput}.${base64url(signature)}`;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new DriveError(
        `Google authentication failed [${res.status}]: ${body}`,
        res.status === 400 || res.status === 401 ? 401 : 502,
      );
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { token: json.access_token, expiresAt: now + json.expires_in };
    return json.access_token;
  } else if (config.authType === "oauth") {
    if (!request) throw new DriveError("OAuth request context is missing.", 500);
    const tokens = getStoredTokens(request);
    if (!tokens || !tokens.access_token) {
      throw new DriveError("Application is not authorized. Please connect your Google Drive.", 401);
    }

    const now = Date.now();
    if (tokens.expiry_date && tokens.expiry_date - 60000 > now) {
      return tokens.access_token;
    }

    if (!tokens.refresh_token) {
      throw new DriveError("Access token expired and no refresh token is available. Please connect again.", 401);
    }

    return await refreshOAuthToken(request, config.clientId!, config.clientSecret!, tokens.refresh_token);
  } else {
    throw new DriveError("Google Drive is not configured.", 503);
  }
}

async function driveFetch(url: string, init: RequestInit = {}, request?: Request): Promise<Response> {
  const token = await getAccessToken(request);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw new DriveError(
      `Network error reaching Google Drive: ${(e as Error).message}`,
      502,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    throw new DriveError(`Google Drive request failed [${res.status}]: ${body}`, res.status);
  }
  return res;
}

async function getWorkingRootId(request: Request): Promise<string> {
  const { rootFolderId } = readConfig();
  if (rootFolderId === DRIVE_ROOT_ID) return DRIVE_ROOT_ID;
  try {
    await getFolderMeta(rootFolderId, request);
    return rootFolderId;
  } catch (error) {
    const status = error instanceof DriveError ? error.status : 0;
    if (status === 403 || status === 404) return DRIVE_ROOT_ID;
    throw error;
  }
}

async function resolveParentId(parentId: string | undefined, request: Request): Promise<string> {
  if (!parentId) return getWorkingRootId(request);
  if (await isAccessibleFolder(parentId, request)) return parentId;
  return getWorkingRootId(request);
}

/* ---------------------------------- types -------------------------------- */

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

type RawFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  thumbnailLink?: string;
  webViewLink?: string;
};

const FIELDS =
  "files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink),nextPageToken";

function toItem(f: RawFile): DriveItem {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : null,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    thumbnailLink: f.thumbnailLink ?? null,
    webViewLink: f.webViewLink ?? null,
    isFolder: f.mimeType === FOLDER_MIME,
  };
}

/* -------------------------------- operations ------------------------------ */

export async function listChildren(folderId: string | undefined, request: Request): Promise<DriveItem[]> {
  const parent = folderId || (await getWorkingRootId(request));
  const items: DriveItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${parent}' in parents and trashed = false`,
      fields: FIELDS,
      pageSize: "200",
      orderBy: "folder,createdTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`${DRIVE_API}/files?${params}`, {}, request);
    const json = (await res.json()) as { files: RawFile[]; nextPageToken?: string };
    items.push(...(json.files ?? []).map(toItem));
    pageToken = json.nextPageToken;
  } while (pageToken);

  return items;
}

export async function listFolders(request: Request): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: FIELDS,
      pageSize: "200",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`${DRIVE_API}/files?${params}`, {}, request);
    const json = (await res.json()) as { files: RawFile[]; nextPageToken?: string };
    items.push(...(json.files ?? []).map(toItem));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return items;
}

export async function getFolderMeta(
  folderId: string,
  request: Request,
): Promise<{ id: string; name: string; parentId: string | null }> {
  const params = new URLSearchParams({
    fields: "id,name,parents",
    supportsAllDrives: "true",
  });
  const res = await driveFetch(`${DRIVE_API}/files/${folderId}?${params}`, {}, request);
  const json = (await res.json()) as { id: string; name: string; parents?: string[] };
  return { id: json.id, name: json.name, parentId: json.parents?.[0] ?? null };
}

export async function getBreadcrumb(
  folderId: string,
  request: Request,
): Promise<Array<{ id: string; name: string }>> {
  const rootFolderId = await getWorkingRootId(request);
  const trail: Array<{ id: string; name: string }> = [];
  let current: string | null = folderId;
  let guard = 0;
  while (current && current !== rootFolderId && guard++ < 20) {
    const meta = await getFolderMeta(current, request);
    trail.unshift({ id: meta.id, name: meta.name });
    current = meta.parentId;
  }
  return trail;
}

export async function createFolder(name: string, parentId: string | undefined, request: Request): Promise<DriveItem> {
  const parent = await resolveParentId(parentId, request);
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await driveFetch(`${DRIVE_API}/files?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  }, request);
  return toItem((await res.json()) as RawFile);
}

export async function findFolderByName(
  name: string,
  parentId: string,
  request: Request,
): Promise<DriveItem | null> {
  const escaped = name.replace(/'/g, "\\'");
  const params = new URLSearchParams({
    q: `name = '${escaped}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`,
    fields: FIELDS,
    pageSize: "1",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await driveFetch(`${DRIVE_API}/files?${params}`, {}, request);
  const json = (await res.json()) as { files: RawFile[] };
  return json.files?.[0] ? toItem(json.files[0]!) : null;
}

/** Returns the YYYY-MM-DD folder inside `parentId`, creating it only if absent. */
export async function ensureDateFolder(parentId: string, request: Request, date = new Date()): Promise<string> {
  const name = date.toISOString().slice(0, 10);
  const existing = await findFolderByName(name, parentId, request);
  if (existing) return existing.id;
  const created = await createFolder(name, parentId, request);
  return created.id;
}

async function isAccessibleFolder(folderId: string, request: Request): Promise<boolean> {
  try {
    await getFolderMeta(folderId, request);
    return true;
  } catch (error) {
    const status = error instanceof DriveError ? error.status : 0;
    if (status === 403 || status === 404) return false;
    throw error;
  }
}

export async function uploadFile(
  file: File,
  opts: { parentId?: string; useDateFolder?: boolean } = {},
  request: Request,
): Promise<DriveItem> {
  const rootFolderId = await getWorkingRootId(request);
  let parent: string | undefined;

  if (await isAccessibleFolder(opts.parentId || rootFolderId, request)) {
    parent = opts.parentId || rootFolderId;
    if (opts.useDateFolder && !opts.parentId) {
      try {
        parent = await ensureDateFolder(parent, request);
      } catch (error) {
        const status = error instanceof DriveError ? error.status : 0;
        if (status !== 403 && status !== 404) throw error;
        parent = undefined;
      }
    }
  }

  const boundary = `lovable-${crypto.randomUUID()}`;
  const createBody = (parentId?: string) => {
    const metadata = JSON.stringify({
      name: file.name,
      ...(parentId ? { parents: [parentId] } : {}),
    });
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    return new Blob([head, file, tail]);
  };

  const params = new URLSearchParams({
    uploadType: "multipart",
    fields: "id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink",
    supportsAllDrives: "true",
  });
  let res: Response;
  try {
    res = await driveFetch(`${DRIVE_UPLOAD_API}/files?${params}`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: createBody(parent),
    }, request);
  } catch (error) {
    const status = error instanceof DriveError ? error.status : 0;
    if (!parent || (status !== 403 && status !== 404)) throw error;
    res = await driveFetch(`${DRIVE_UPLOAD_API}/files?${params}`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: createBody(),
    }, request);
  }
  return toItem((await res.json()) as RawFile);
}

export async function deleteFile(fileId: string, request: Request): Promise<void> {
  const params = new URLSearchParams({ supportsAllDrives: "true" });
  await driveFetch(`${DRIVE_API}/files/${fileId}?${params}`, { method: "DELETE" }, request);
}

export async function getFileMeta(fileId: string, request: Request): Promise<DriveItem> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?${params}`, {}, request);
  return toItem((await res.json()) as RawFile);
}

/** Streams the raw file bytes from Drive. */
export async function fetchFileContent(
  fileId: string,
  request: Request,
  range?: string | null,
): Promise<Response> {
  const params = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  const token = await getAccessToken(request);
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (range) headers.set("Range", range);
  const res = await fetch(`${DRIVE_API}/files/${fileId}?${params}`, { headers });
  if (!res.ok && res.status !== 206) {
    const body = await res.text();
    throw new DriveError(`Google Drive download failed [${res.status}]: ${body}`, res.status);
  }
  return res;
}

export async function renameFile(fileId: string, name: string, request: Request): Promise<DriveItem> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink",
    supportsAllDrives: "true",
  });
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }, request);
  return toItem((await res.json()) as RawFile);
}

export async function moveFile(fileId: string, destinationId: string, request: Request): Promise<DriveItem> {
  const metaParams = new URLSearchParams({ fields: "id,parents", supportsAllDrives: "true" });
  const metaResponse = await driveFetch(`${DRIVE_API}/files/${fileId}?${metaParams}`, {}, request);
  const meta = (await metaResponse.json()) as { id: string; parents?: string[] };
  const params = new URLSearchParams({
    addParents: destinationId,
    supportsAllDrives: "true",
    fields: "id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink",
  });
  if (meta.parents?.length) params.set("removeParents", meta.parents.join(","));
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  }, request);
  return toItem((await res.json()) as RawFile);
}
