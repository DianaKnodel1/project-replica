// Public endpoint: Bootstrap-Script für einen neuen Landing-Server.
// Aufruf: curl -sSL https://mb-portal.com/api/public/landing-server-bootstrap?token=XYZ | bash
//
// Validiert Token gegen landing_servers.bootstrap_token, gibt dann ein
// idempotentes Setup-Script aus (Node, Caddy, server.js, systemd) — alle
// benötigten Env-Vars (Supabase-URL/Key, Portal-URL, Server-ID, Token) sind
// direkt eingebettet.

import { createFileRoute } from "@tanstack/react-router";
import { renderScript } from "@/lib/landing-bootstrap-script";

export const Route = createFileRoute("/api/public/landing-server-bootstrap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const clean = url.searchParams.get("clean") === "1";
        if (!token || token.length < 20) {
          return new Response("# fehlender token", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: server, error } = await supabaseAdmin
          .from("landing_servers")
          .select("id, name, hostname, ip")
          .eq("bootstrap_token", token)
          .maybeSingle();
        if (error || !server) {
          return new Response("# Token unbekannt — Server zuerst im Portal anlegen", { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? "";
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        const portalOrigin = normalizePortalOrigin(url.origin);
        const acmeEmail = process.env.ACME_EMAIL ?? "admin@mb-portal.com";

        const script = renderScript({
          serverName: server.name,
          serverId: server.id,
          token,
          supabaseUrl,
          supabaseKey,
          portalOrigin,
          acmeEmail,
          clean,
        });

        // Log Bootstrap-Abruf
        await supabaseAdmin.from("automation_log").insert({
          action: "server.bootstrap",
          target: server.name,
          status: "ok",
          payload: { ip: String(server.ip ?? ""), hostname: server.hostname },
        });

        return new Response(script, {
          status: 200,
          headers: { "content-type": "text/x-shellscript; charset=utf-8" },
        });
      },
    },
  },
});

function normalizePortalOrigin(origin: string): string {
  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) return origin;
  const httpsOrigin = origin.replace(/^http:\/\//, "https://");
  try {
    const parsed = new URL(httpsOrigin);
    const previewMatch = /^id-preview--([a-f0-9-]+)\.lovable\.app$/i.exec(parsed.hostname);
    if (previewMatch) return `https://project--${previewMatch[1]}-dev.lovable.app`;
  } catch {
    // Fallback below keeps the previous behavior for unusual origins.
  }
  return httpsOrigin;
}
