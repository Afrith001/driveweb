import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createFolder, DriveError, isConfigured } from "@/lib/drive.server";
import { errorResponse } from "@/lib/api-utils.server";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().trim().min(1).optional(),
});

export const Route = createFileRoute("/api/folders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isConfigured()) throw new DriveError("Google Drive is not configured.", 503);
          const parsed = schema.safeParse(await request.json());
          if (!parsed.success) throw new DriveError("Please enter a valid folder name.", 400);
          const folder = await createFolder(parsed.data.name, parsed.data.parentId);
          return Response.json({ folder });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
