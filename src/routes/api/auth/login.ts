import { createFileRoute } from "@tanstack/react-router";
import { getOAuthRedirectUri, readConfig, DriveError } from "@/lib/drive.server";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const config = readConfig();
          if (config.authType !== "oauth") {
            throw new DriveError("Google OAuth is not configured in the environment variables.", 400);
          }

          const redirectUri = getOAuthRedirectUri(config);
          console.info("Google OAuth redirect URI:", redirectUri);

          const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
          googleAuthUrl.searchParams.set("response_type", "code");
          googleAuthUrl.searchParams.set("client_id", config.clientId!);
          googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
          googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive");
          googleAuthUrl.searchParams.set("access_type", "offline");
          googleAuthUrl.searchParams.set("prompt", "consent");

          return new Response(null, {
            status: 302,
            headers: {
              Location: googleAuthUrl.toString(),
            },
          });
        } catch (e) {
          const status = (e as any)?.status || 500;
          return Response.json({ error: (e as Error).message }, { status });
        }
      },
    },
  },
});
