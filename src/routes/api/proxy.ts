import { createFileRoute } from "@tanstack/react-router";

const BLOCKED_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
]);

export const Route = createFileRoute("/api/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!target) return new Response("Missing url", { status: 400 });

        let targetUrl: URL;
        try {
          targetUrl = new URL(target);
        } catch {
          return new Response("Invalid URL", { status: 400 });
        }
        if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
          return new Response("Only http/https allowed", { status: 400 });
        }

        let upstream: Response;
        try {
          upstream = await fetch(targetUrl.toString(), {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
          });
        } catch (err) {
          return new Response(`Fetch failed: ${String(err)}`, { status: 502 });
        }

        const responseHeaders = new Headers();
        upstream.headers.forEach((value, key) => {
          if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
            responseHeaders.set(key, value);
          }
        });
        responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        const contentType = upstream.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          let html = await upstream.text();
          const base = `${targetUrl.protocol}//${targetUrl.host}`;
          // Inject base tag so relative links resolve to the origin site
          html = html.replace(/(<head[^>]*>)/i, `$1<base href="${base}/">`);
          return new Response(html, { status: upstream.status, headers: responseHeaders });
        }

        return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
      },
    },
  },
});
