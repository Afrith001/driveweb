import { createFileRoute } from "@tanstack/react-router";
import { fetchFileContent, getFileMeta, isConfigured, DriveError } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

/** Inline streaming endpoint used by <img>, <video> and the PDF viewer. */
export const Route = createFileRoute("/api/files/$fileId/preview")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const range = request.headers.get("range");
          const [meta, upstream] = await Promise.all([
            getFileMeta(params.fileId),
            fetchFileContent(params.fileId, range),
          ]);
          const headers = new Headers();
          headers.set("Content-Type", meta.mimeType || "application/octet-stream");
          headers.set("Content-Disposition", "inline");
          headers.set("Accept-Ranges", "bytes");
          for (const h of ["content-length", "content-range"]) {
            const v = upstream.headers.get(h);
            if (v) headers.set(h, v);
          }
          return new Response(upstream.body, { status: upstream.status, headers });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
