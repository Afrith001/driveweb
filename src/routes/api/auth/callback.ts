import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectUrl = `${url.protocol}//${url.host}/auth/google/callback${url.search}`;
        return new Response(null, {
          status: 302,
          headers: {
            Location: redirectUrl,
          },
        });
      },
    },
  },
});
