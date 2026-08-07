import { DriveError } from "./drive.server";

export function errorResponse(e: unknown): Response {
  const err = e as DriveError;
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = err?.message || "Unexpected server error.";
  console.error("API error:", status, message);
  return Response.json({ error: friendly(status, message) }, { status });
}

function friendly(status: number, message: string): string {
  if (status === 503) return message;
  if (status === 401 || status === 403)
    return "Google Drive rejected the credentials. Check the service account key and make sure the root folder is shared with the service account email.";
  if (status === 404) return "That file or folder no longer exists in Google Drive.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 429) return "Google Drive rate limit reached. Please try again in a moment.";
  if (status >= 500) return `Google Drive is unavailable right now. (${message})`;
  return message;
}
