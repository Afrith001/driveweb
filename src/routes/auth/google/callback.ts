import { createFileRoute } from "@tanstack/react-router";
import { getOAuthRedirectUri, oauthCookieHeader, readConfig, DriveError } from "@/lib/drive.server";

export const Route = createFileRoute("/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const config = readConfig();
          if (config.authType !== "oauth") {
            throw new DriveError("Google OAuth is not configured in the environment variables.", 400);
          }

          const url = new URL(request.url);
          const redirectUri = getOAuthRedirectUri(config);
          const code = url.searchParams.get("code");
          if (!code) {
            throw new DriveError("No authorization code was returned by Google.", 400);
          }

          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: config.clientId!,
              client_secret: config.clientSecret!,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new DriveError(`Failed to exchange authorization code: ${body}`, res.status);
          }

          const json = (await res.json()) as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
          };

          if (!json.refresh_token) {
            throw new DriveError(
              "No refresh token was returned. If you are re-authorizing, please remove this application's access from your Google account settings first, then try again.",
              400,
            );
          }

          const tokens = {
            access_token: json.access_token,
            refresh_token: json.refresh_token,
            expiry_date: Date.now() + json.expires_in * 1000,
          };

          // Redirect back to root
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/",
              "Set-Cookie": oauthCookieHeader(tokens),
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
