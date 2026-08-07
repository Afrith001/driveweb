import { createFileRoute } from "@tanstack/react-router";
import { isConfigured, isAuthorized, readConfig } from "@/lib/drive.server";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        let authType: "service_account" | "oauth" | "none" = "none";
        try {
          authType = readConfig().authType;
        } catch {
          // ignore
        }
        return Response.json({
          configured: isConfigured(),
          authorized: isAuthorized(),
          authType,
        });
      },
    },
  },
});
