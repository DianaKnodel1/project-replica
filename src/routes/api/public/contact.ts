import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Kontaktformular der Firmen-Websites → Admin-Postfach (lead_messages, kind "lead").
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Origin",
  "Access-Control-Max-Age": "86400",
};

const Schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().min(1).max(4000),
  domain: z.string().trim().max(253).optional().nullable(),
  tenant_id: z.string().uuid().optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

function cleanHost(v: string | null | undefined): string {
  return String(v ?? "").toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").replace(/^portal\./, "");
}

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let payload: unknown;
        try { payload = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(payload);
        if (!parsed.success) return json({ error: "Validation failed" }, 400);
        const d = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Firma über die Domain der Website ermitteln (Origin gewinnt vor Payload).
        let host = "";
        try { host = cleanHost(new URL(request.headers.get("origin") || request.headers.get("referer") || "").hostname); } catch { /* ignore */ }
        if (!host || host === "localhost") host = cleanHost(d.domain);
        let tenantId: string | null = null;
        if (host) {
          const { data: lp } = await (supabaseAdmin as any).from("landing_pages").select("tenant_id").eq("domain", host).not("tenant_id", "is", null).limit(1).maybeSingle();
          tenantId = (lp as any)?.tenant_id ?? null;
          if (!tenantId) {
            const { data: t1 } = await supabaseAdmin.from("tenants").select("id").eq("primary_domain", host).maybeSingle();
            tenantId = t1?.id ?? null;
          }
          if (!tenantId) {
            const { data: t2 } = await supabaseAdmin.from("tenants").select("id").eq("domain", host).maybeSingle();
            tenantId = t2?.id ?? null;
          }
        }
        if (!tenantId && d.tenant_id) {
          const { data: t3 } = await supabaseAdmin.from("tenants").select("id").eq("id", d.tenant_id).maybeSingle();
          tenantId = t3?.id ?? null;
        }

        const email = d.email.toLowerCase();
        const body = [
          d.message,
          "",
          `Name: ${d.name}`,
          `E-Mail: ${email}`,
          d.phone ? `Telefon: ${d.phone}` : null,
          host ? `Website: ${host}` : null,
        ].filter((x) => x !== null).join("\n");

        const { data: row, error } = await (supabaseAdmin as any)
          .from("lead_messages")
          .insert({
            direction: "in",
            from_email: email,
            to_email: null,
            peer_email: email,
            kind: "lead",
            handled: false,
            tenant_id: tenantId,
            subject: `Kontaktanfrage über ${host || "Website"} – ${d.name}`,
            body_text: body,
          } as any)
          .select("id")
          .single();
        if (error || !row) {
          console.error("[contact] insert_failed", error?.message);
          return json({ error: "Could not save" }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
