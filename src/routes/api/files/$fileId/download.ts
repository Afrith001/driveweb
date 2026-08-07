import { createFileRoute } from "@tanstack/react-router";
import { applyOAuthCookie, fetchFileContent, getFileMeta, isConfigured, DriveError } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

export const Route = createFileRoute("/api/files/$fileId/download")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const meta = await getFileMeta(params.fileId, request);
          const upstream = await fetchFileContent(params.fileId, request);
          const headers = new Headers();
          headers.set("Content-Type", meta.mimeType || "application/octet-stream");
          headers.set(
            "Content-Disposition",
            `attachment; filename="${meta.name.replace(/"/g, "")}"`,
          );
          const len = upstream.headers.get("content-length");
          if (len) headers.set("Content-Length", len);
          return applyOAuthCookie(new Response(upstream.body, { status: 200, headers }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
