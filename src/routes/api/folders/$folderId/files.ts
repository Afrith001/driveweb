import { createFileRoute } from "@tanstack/react-router";
import { applyOAuthCookie, DriveError, getBreadcrumb, isConfigured, listChildren } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

export const Route = createFileRoute("/api/folders/$folderId/files")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const [items, breadcrumb] = await Promise.all([
            listChildren(params.folderId, request),
            getBreadcrumb(params.folderId, request),
          ]);
          return applyOAuthCookie(Response.json({ items, breadcrumb }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
