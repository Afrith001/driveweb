import { createFileRoute } from "@tanstack/react-router";
import { DriveError, getBreadcrumb, isConfigured, listChildren } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

export const Route = createFileRoute("/api/folders/$folderId/files")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const [items, breadcrumb] = await Promise.all([
            listChildren(params.folderId),
            getBreadcrumb(params.folderId),
          ]);
          return Response.json({ items, breadcrumb });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
