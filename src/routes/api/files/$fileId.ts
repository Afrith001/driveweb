import { createFileRoute } from "@tanstack/react-router";
import { deleteFile, DriveError, isConfigured } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

export const Route = createFileRoute("/api/files/$fileId")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          await deleteFile(params.fileId);
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
