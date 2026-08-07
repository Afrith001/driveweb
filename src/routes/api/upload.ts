import { createFileRoute } from "@tanstack/react-router";
import { applyOAuthCookie, DriveError, isConfigured, uploadFile } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB per request

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File) || file.size === 0) {
            throw new DriveError("No file was received.", 400);
          }
          if (file.size > MAX_BYTES) {
            throw new DriveError(
              `"${file.name}" is larger than the ${Math.round(MAX_BYTES / 1024 / 1024)} MB upload limit.`,
              413,
            );
          }
          const parentId = (form.get("parentId") as string) || "";
          const useDateFolder = form.get("useDateFolder") === "true";
          const uploaded = await uploadFile(file, {
            useDateFolder,
            ...(parentId ? { parentId } : {}),
          }, request);
          return applyOAuthCookie(Response.json({ file: uploaded }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
