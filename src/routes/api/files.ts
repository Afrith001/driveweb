import { createFileRoute } from "@tanstack/react-router";
import { applyOAuthCookie, DriveError, listChildren, isConfigured } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const url = new URL(request.url);
          const folderId = url.searchParams.get("folderId") ?? undefined;
          const items = await listChildren(folderId, request);
          return applyOAuthCookie(Response.json({ items }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
