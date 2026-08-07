import { createFileRoute } from "@tanstack/react-router";
import { applyOAuthCookie, deleteFile, DriveError, isConfigured, moveFile, renameFile } from "@/lib/drive.server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-utils.server";

export const Route = createFileRoute("/api/files/$fileId")({
  server: {
    handlers: {
      DELETE: async ({ params, request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          await deleteFile(params.fileId, request);
          return applyOAuthCookie(Response.json({ ok: true }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
      PATCH: async ({ params, request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(await request.json());
          if (!parsed.success) throw new DriveError("Please enter a valid name.", 400);
          const file = await renameFile(params.fileId, parsed.data.name, request);
          return applyOAuthCookie(Response.json({ file }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
      PUT: async ({ params, request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const parsed = z.object({ destinationId: z.string().trim().min(1) }).safeParse(await request.json());
          if (!parsed.success) throw new DriveError("Please select a destination folder.", 400);
          const file = await moveFile(params.fileId, parsed.data.destinationId, request);
          return applyOAuthCookie(Response.json({ file }), request);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
