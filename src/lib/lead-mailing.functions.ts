import { matchMailsToPeople, type MailPerson } from "@/lib/lead-mailing";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nicht autorisiert");
}

/** Postfach-Zugriff: Admin (alles) oder Caller (nur zugewiesene Personen, per RLS). */
async function requireMailAccess(ctx: { supabase: any; userId: string }): Promise<"admin" | "caller"> {
  const { data, error } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => String(r.role));
  if (roles.includes("admin")) return "admin";
  if (roles.includes("caller")) return "caller";
  throw new Error("Nicht autorisiert");
}

const mask = (v: string | null | undefined) => (v?.trim() ? `••••••••${v.trim().slice(-4)}` : null);

export const getLeadMailingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({}).passthrough().parse(i ?? {}))
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: ss }, { data: tenants }, { data: settings }, { data: imports }] = await Promise.all([
      db.from("system_settings").select("resend_api_key, resend_webhook_secret").eq("id", 1).maybeSingle(),
      db.from("tenants").select("id, name, logo_url, primary_color, domain").order("name"),
      db.from("lead_mail_settings").select("*"),
      db.from("lead_imports").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    const statusCounts: Record<string, Record<string, number>> = {};
    for (const t of tenants ?? []) {
      const counts: Record<string, number> = {};
      for (const st of ["pending", "sent", "failed", "bounced", "unsubscribed", "replied"]) {
        const { count } = await db.from("applications").select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id).eq("lead_mail_status", st);
        counts[st] = count ?? 0;
      }
      statusCounts[t.id] = counts;
    }
    return {
      resendKeyMasked: mask(ss?.resend_api_key),
      webhookSecretMasked: mask(ss?.resend_webhook_secret),
      tenants: tenants ?? [],
      settings: settings ?? [],
      imports: imports ?? [],
      statusCounts,
    };
  });

export const saveResendAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resend_api_key: z.string().trim().regex(/^re_/, "Resend-Schlüssel beginnt mit re_").optional(),
    resend_webhook_secret: z.string().trim().regex(/^whsec_/, "Webhook-Secret beginnt mit whsec_").optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const patch: Record<string, string> = {};
    if (data.resend_api_key) patch.resend_api_key = data.resend_api_key;
    if (data.resend_webhook_secret) patch.resend_webhook_secret = data.resend_webhook_secret;
    if (!Object.keys(patch).length) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).from("system_settings")
      .upsert({ id: 1, ...patch }, { onConflict: "id" }).select("resend_api_key, resend_webhook_secret");
    if (error) {
      if (/column .* does not exist/i.test(error.message)) throw new Error("Datenbank-Update fehlt (Lead-Mailing). Bitte migrate.sh auf dem Backend ausführen.");
      throw new Error(error.message);
    }
    const row = rows?.[0];
    if (!row || (patch.resend_api_key && row.resend_api_key !== patch.resend_api_key)) {
      throw new Error("Schlüssel wurde nicht gespeichert – bitte erneut versuchen.");
    }
    return { ok: true };
  });

const SettingsInput = z.object({
  tenant_id: z.string().uuid(),
  active: z.boolean(),
  sender_email: z.string().trim().email().max(200).nullable(),
  sender_name: z.string().trim().max(120).nullable(),
  subject: z.string().trim().max(300).nullable(),
  body: z.string().trim().max(8000).nullable(),
  homepage_url: z.string().trim().url().max(500).nullable(),
  calendly_url: z.string().trim().url().max(500).nullable(),
  daily_limit: z.number().int().min(1).max(2000),
  sig_name: z.string().trim().max(120).nullable().optional(),
  sig_position: z.string().trim().max(120).nullable().optional(),
  sig_phone: z.string().trim().max(60).nullable().optional(),
  sig_website: z.string().trim().max(300).nullable().optional(),
  sig_color: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).nullable().optional(),
});

export const saveLeadMailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SettingsInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("lead_mail_settings").upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" }).select("tenant_id");
    if (error) {
      if (/column .* does not exist|schema cache/i.test(error.message)) throw new Error("Datenbank-Update fehlt (Postfach/Signatur). Bitte migrate.sh auf dem Backend ausführen.");
      throw new Error(error.message);
    }
    if (!rows?.length) throw new Error("Einstellungen wurden nicht gespeichert – fehlende Berechtigung.");
    return { ok: true };
  });

const ImportInput = z.object({
  tenant_id: z.string().uuid(),
  file_name: z.string().max(300),
  rows: z.array(z.object({
    firstName: z.string().max(120), lastName: z.string().max(120),
    email: z.string().email().max(254), phone: z.string().max(60).nullable(),
  })).min(1).max(5000),
});

export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const emails = data.rows.map((r) => r.email.toLowerCase());
    const existing = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { data: found } = await db.from("applications").select("email").eq("tenant_id", data.tenant_id).in("email", chunk);
      for (const f of found ?? []) existing.add(String(f.email).toLowerCase());
    }
    const fresh = data.rows.filter((r) => !existing.has(r.email.toLowerCase()));
    const { data: imp, error: impErr } = await db.from("lead_imports").insert({
      tenant_id: data.tenant_id, file_name: data.file_name, total: data.rows.length,
      imported: fresh.length, skipped: data.rows.length - fresh.length, created_by: context.userId,
    }).select("id").single();
    if (impErr) throw new Error(impErr.message);
    for (let i = 0; i < fresh.length; i += 200) {
      const batch = fresh.slice(i, i + 200).map((r) => ({
        tenant_id: data.tenant_id,
        email: r.email.toLowerCase(),
        first_name: r.firstName || null,
        last_name: r.lastName || null,
        full_name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email,
        phone: r.phone,
        source_slug: "indeed",
        lead_source: "indeed",
        lead_mail_status: "pending",
        lead_import_id: imp.id,
        message: "Indeed-Lead (CSV-Import)",
      }));
      const { error } = await db.from("applications").insert(batch);
      if (error) throw new Error(`Import abgebrochen nach ${i} Leads: ${error.message}`);
    }
    return { imported: fresh.length, skipped: data.rows.length - fresh.length };
  });

// ───────────── Gemeinsames Postfach ─────────────

const peerOf = (m: any) => String(m.peer_email || (m.direction === "in" ? m.from_email : m.to_email) || "").toLowerCase();

export const listMailThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    filter: z.enum(["all", "sent", "mail", "contact", "lead", "employee", "unread"]).default("all"),
    q: z.string().trim().max(120).default(""),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireMailAccess(context);
    const db = context.supabase as any;
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: page, error } = await db.from("lead_messages")
        .select("id, application_id, profile_id, tenant_id, direction, from_email, to_email, peer_email, kind, subject, body_text, handled, created_at, opened_at")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
      if (error) throw new Error(error.message);
      rows.push(...(page ?? []));
      if (!page || page.length < 500) break;
    }
    const threads = new Map<string, any>();
    for (const m of rows ?? []) {
      const peer = peerOf(m);
      if (!peer) continue;
      let t = threads.get(peer);
      if (!t) {
        t = { peer, last: m, unread: 0, kind: m.kind === "contact" ? "lead" : m.kind ?? "lead", contact: false, mail: false, site: null as string | null, application_id: m.application_id, profile_id: m.profile_id, tenant_id: m.tenant_id };
        threads.set(peer, t);
      }
      // Kontaktanfrage = Website-Formular (kind "contact"; ältere Einträge am Betreff erkennbar).
      const isContact = m.kind === "contact" || /^Kontaktanfrage über /.test(String(m.subject ?? ""));
      if (isContact) {
        t.contact = true;
        t.site ||= /^Kontaktanfrage über (\S+)/.exec(String(m.subject ?? ""))?.[1] ?? null;
      } else t.mail = true;
      if (m.direction === "in" && !m.handled) t.unread++;
      t.application_id ||= m.application_id; t.profile_id ||= m.profile_id; t.tenant_id ||= m.tenant_id;
      if (m.kind === "employee") t.kind = "employee";
    }
    const list = [...threads.values()];
    const appIds = [...new Set(list.map((t) => t.application_id).filter(Boolean))];
    const profIds = [...new Set(list.map((t) => t.profile_id).filter(Boolean))];
    const [{ data: apps }, { data: profs }] = await Promise.all([
      appIds.length ? db.from("applications").select("id, full_name, lead_mail_status").in("id", appIds.slice(0, 300)) : { data: [] },
      profIds.length ? db.from("profiles").select("id, full_name").in("id", profIds.slice(0, 300)) : { data: [] },
    ]);
    const appBy = new Map((apps ?? []).map((a: any) => [a.id, a]));
    const profBy = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const q = data.q.toLowerCase();
    const allThreads = list.map((t) => ({
      peer: t.peer, kind: t.kind, unread: t.unread, tenant_id: t.tenant_id,
      contact: t.contact as boolean, mail: t.mail as boolean, site: t.site as string | null,
      application_id: t.application_id ?? null, profile_id: t.profile_id ?? null,
      name: (profBy.get(t.profile_id) as any)?.full_name ?? (appBy.get(t.application_id) as any)?.full_name ?? t.peer,
      status: (appBy.get(t.application_id) as any)?.lead_mail_status ?? null,
      subject: t.last.subject, preview: String(t.last.body_text ?? "").slice(0, 140),
      last_direction: t.last.direction, last_opened: !!t.last.opened_at, last_at: t.last.created_at,
    }));
    const unreadTotal = allThreads.filter((t) => t.unread > 0).length;
    if (data.filter === "sent") {
      const byPeer = new Map(allThreads.map((t) => [t.peer, t]));
      const sent = rows.filter((m) => m.direction === "out").map((m) => {
        const t: any = byPeer.get(peerOf(m)) ?? {};
        return { ...t, peer: peerOf(m), name: t.name ?? peerOf(m), unread: 0, subject: m.subject, preview: String(m.body_text ?? "").slice(0, 140),
          last_direction: "out", last_opened: !!m.opened_at, last_at: m.created_at, message_id: m.id };
      }).filter((t) => !q || String(t.name).toLowerCase().includes(q) || t.peer.includes(q)).slice(0, 500);
      return { threads: sent, unreadTotal };
    }
    const out = allThreads.filter((t) =>
      (data.filter === "all" || (data.filter === "unread" ? t.unread > 0
        : data.filter === "contact" ? t.contact
        : data.filter === "mail" ? t.mail
        : data.filter === "employee" ? t.kind === "employee" : t.kind === "lead"))
      && (!q || t.name.toLowerCase().includes(q) || t.peer.includes(q)));
    out.sort((a, b) => (Number(b.unread > 0) - Number(a.unread > 0)) || String(b.last_at).localeCompare(String(a.last_at)));
    return { threads: out, unreadTotal };
  });

export const getMailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ peer: z.string().trim().toLowerCase().email() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireMailAccess(context);
    const db = context.supabase as any;
    const { data: msgs, error } = await db.from("lead_messages").select("*")
      .or(`peer_email.eq.${data.peer},from_email.ilike.${data.peer},to_email.ilike.${data.peer}`)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { messages: msgs ?? [] };
  });

export const setThreadHandled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ peer: z.string().trim().toLowerCase().email(), handled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireMailAccess(context);
    const { error } = await (context.supabase as any).from("lead_messages")
      .update({ handled: data.handled }).eq("direction", "in").or(`peer_email.eq.${data.peer},from_email.ilike.${data.peer}`);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function profileEmail(db: any, profile: { user_id?: string | null }) {
  if (!profile?.user_id) return null;
  const { data } = await db.auth.admin.getUserById(profile.user_id);
  return data?.user?.email?.toLowerCase() ?? null;
}

async function resolveByEmail(db: any, email: string, tenantId?: string | null) {
  const { pickRecipientMatch } = await import("@/lib/mail-recipient-match");
  const { data: apps } = await db.from("applications")
    .select("id, full_name, tenant_id, user_id, created_at").ilike("email", email).limit(20);
  const appIds = (apps ?? []).map((a: any) => a.id);
  const userIds = (apps ?? []).map((a: any) => a.user_id).filter(Boolean);
  let profiles: any[] = [];
  if (appIds.length || userIds.length) {
    const ors = [appIds.length && `application_id.in.(${appIds.join(",")})`, userIds.length && `user_id.in.(${userIds.join(",")})`].filter(Boolean).join(",");
    const { data } = await db.from("profiles").select("id, full_name, tenant_id, user_id, application_id").or(ors).limit(20);
    profiles = data ?? [];
  }
  const m = pickRecipientMatch(apps ?? [], profiles, tenantId);
  return m ? { ...m, email } : null;
}

export const resolveRecipientByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(254), tenantId: z.string().uuid().nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { match: await resolveByEmail(supabaseAdmin as any, data.email, data.tenantId) };
  });

export const searchMailRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ q: z.string().trim().min(2).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const like = `%${data.q.replace(/[%_,()]/g, " ")}%`;
    const [{ data: profs }, { data: apps }] = await Promise.all([
      db.from("profiles").select("id, full_name, user_id, tenant_id").ilike("full_name", like).limit(8),
      db.from("applications").select("id, full_name, email, tenant_id").or(`full_name.ilike.${like},email.ilike.${like}`).limit(8),
    ]);
    const employees = await Promise.all((profs ?? []).map(async (p: any) => ({
      type: "employee" as const, profile_id: p.id, application_id: null, name: p.full_name, tenant_id: p.tenant_id, email: await profileEmail(db, p),
    })));
    return {
      results: [
        ...employees.filter((e) => e.email),
        ...(apps ?? []).filter((a: any) => a.email).map((a: any) => ({
          type: "applicant" as const, profile_id: null, application_id: a.id, name: a.full_name, tenant_id: a.tenant_id, email: String(a.email).toLowerCase(),
        })),
      ],
    };
  });

export const getMailComposeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ profileId: z.string().uuid().optional(), userId: z.string().uuid().optional(), applicationId: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireMailAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: tenants }, { data: settings }, { data: ss }] = await Promise.all([
      db.from("tenants").select("id, name").order("name"),
      db.from("lead_mail_settings").select("tenant_id, sender_email, sender_name"),
      db.from("system_settings").select("resend_api_key").eq("id", 1).maybeSingle(),
    ]);
    const hasResendKey = !!((ss?.resend_api_key as string | null)?.trim() || process.env.RESEND_API_KEY);
    let recipient: any = null;
    if (data.applicationId) {
      const { data: a } = await db.from("applications").select("id, full_name, email, tenant_id").eq("id", data.applicationId).maybeSingle();
      if (a) recipient = { type: "applicant", profile_id: null, application_id: a.id, name: a.full_name, tenant_id: a.tenant_id, email: a.email ? String(a.email).toLowerCase() : null };
    }
    if (data.profileId || data.userId) {
      const { data: p } = await db.from("profiles").select("id, full_name, user_id, tenant_id")
        .eq(data.profileId ? "id" : "user_id", (data.profileId ?? data.userId)!).maybeSingle();
      if (p) recipient = { type: "employee", profile_id: p.id, application_id: null, name: p.full_name, tenant_id: p.tenant_id, email: await profileEmail(db, p) };
    }
    const senders = (tenants ?? []).map((t: any) => {
      const s = (settings ?? []).find((x: any) => x.tenant_id === t.id);
      return { tenant_id: t.id, name: t.name, sender_email: s?.sender_email ?? null, sender_name: s?.sender_name ?? null };
    });
    return { senders, recipient, hasResendKey };
  });

export const sendPortalMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    to: z.string().trim().toLowerCase().email().max(254),
    tenantId: z.string().uuid(),
    subject: z.string().trim().min(1).max(300),
    text: z.string().trim().min(1).max(8000),
    profileId: z.string().uuid().nullable().optional(),
    applicationId: z.string().uuid().nullable().optional(),
    override: z.boolean().optional(),
    attachments: z.array(z.object({
      name: z.string().trim().min(1).max(200),
      type: z.string().max(120).default("application/octet-stream"),
      data: z.string().max(14_000_000),
    })).max(10).default([]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const access = await requireMailAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    if (access === "caller") {
      const { data: ok } = await (context.supabase as any).rpc("caller_can_see_mail", {
        _user_id: context.userId, _app_id: data.applicationId ?? null, _profile_id: data.profileId ?? null, _peer: data.to,
      });
      if (!ok) throw new Error("Diese Person ist dir nicht zugewiesen.");
      data.override = false;
    }
    if (!data.profileId && !data.applicationId) {
      const m = await resolveByEmail(db, data.to, data.tenantId);
      if (m) { data.profileId = m.profile_id; data.applicationId = m.application_id; }
    }
    const { data: blocked } = await db.from("applications").select("id, lead_mail_status, lead_mail_error")
      .ilike("email", data.to).in("lead_mail_status", ["unsubscribed", "bounced"]).limit(1);
    if (blocked?.length && !data.profileId) {
      if (!data.override) {
        const { mailBlockMessage } = await import("@/lib/lead-mailing");
        throw new Error(mailBlockMessage(blocked[0].lead_mail_status, blocked[0].lead_mail_error));
      }
      // Admin hebt die Sperre bewusst auf.
      await db.from("applications").update({ lead_mail_status: "replied", lead_mail_error: null })
        .ilike("email", data.to).in("lead_mail_status", ["unsubscribed", "bounced"]);
    }
    const { data: s } = await db.from("lead_mail_settings").select("sender_email, sender_name").eq("tenant_id", data.tenantId).maybeSingle();
    if (!s?.sender_email) throw new Error("Für diese Firma ist keine Absender-Adresse hinterlegt (Admin → Lead-Mailing).");
    const { loadResendConfig, sendViaResend, loadSignature, storeAttachment } = await import("@/lib/lead-mailing.server");
    const { apiKey } = await loadResendConfig();
    if (!apiKey) throw new Error("Resend-Schlüssel fehlt (Admin → Lead-Mailing).");
    const { checkMailAttachments } = await import("@/lib/lead-mailing");
    const files = data.attachments.map((a) => ({ ...a, bytes: Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0)) }));
    const problem = checkMailAttachments(files.map((f) => ({ name: f.name, size: f.bytes.byteLength })));
    if (problem) throw new Error(problem);
    const stored: Awaited<ReturnType<typeof storeAttachment>>[] = [];
    for (const f of files) stored.push(await storeAttachment(db, `out/${data.tenantId}`, f.name, f.type, f.bytes));
    // Art des Verlaufs: Mitarbeiter, Lead (bekannter Lead-Verlauf) oder frei.
    const { data: prev } = await db.from("lead_messages").select("kind, application_id")
      .eq("peer_email", data.to).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const prevKind = prev?.kind === "contact" ? "lead" : prev?.kind;
    const kind = data.profileId ? "employee" : prevKind ?? (data.applicationId ? "lead" : "other");
    const name = (s.sender_name ?? "").replace(/["<>]/g, "");
    const r = await sendViaResend({
      apiKey, from: name ? `"${name}" <${s.sender_email}>` : s.sender_email, to: data.to,
      subject: data.subject, text: data.text, replyTo: s.sender_email,
      kind: kind === "lead" ? "lead" : kind === "employee" ? "employee" : "other",
      signature: await loadSignature(data.tenantId, s.sender_email),
      attachments: files.map((f) => ({ filename: f.name, content: f.data })),
    });
    await db.from("lead_messages").insert({
      attachments: stored,
      application_id: data.applicationId ?? prev?.application_id ?? null, profile_id: data.profileId ?? null,
      tenant_id: data.tenantId, direction: "out", from_email: s.sender_email, to_email: data.to,
      peer_email: data.to, kind, subject: data.subject, body_text: data.text, provider_id: r.id || null, handled: true,
    });
    await db.from("lead_messages").update({ handled: true }).eq("direction", "in").eq("peer_email", data.to);
    return { ok: true };
  });

export const getMailStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    applicationIds: z.array(z.string().uuid()).max(500).default([]),
    profileIds: z.array(z.string().uuid()).max(500).default([]),
    full: z.boolean().default(false),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const cols = "id, application_id, profile_id, peer_email, subject, created_at, delivered_at, opened_at, open_count, bounced_at";
    const chunks = <T,>(arr: T[]) => { const out: T[][] = []; for (let i = 0; i < arr.length; i += 100) out.push(arr.slice(i, i + 100)); return out; };
    // Personen-Verknüpfung: Bewerbung <-> Mitarbeiterprofil, plus E-Mail-Adressen der Bewerbungen.
    const apps: any[] = []; const profs: any[] = [];
    for (const c of chunks(data.applicationIds)) {
      const [{ data: a }, { data: p }] = await Promise.all([
        db.from("applications").select("id, email, user_id").in("id", c),
        db.from("profiles").select("id, application_id").in("application_id", c),
      ]);
      apps.push(...(a ?? [])); profs.push(...(p ?? []));
    }
    for (const c of chunks(data.profileIds)) {
      const [{ data: p }, { data: a }] = await Promise.all([
        db.from("profiles").select("id, application_id").in("id", c),
        db.from("applications").select("id, email, user_id").in("user_id", c),
      ]);
      profs.push(...(p ?? [])); apps.push(...(a ?? []));
    }
    const extraAppIds = profs.map((p) => p.application_id).filter((id) => id && !apps.some((a) => a.id === id));
    for (const c of chunks([...new Set(extraAppIds)] as string[])) {
      const { data: a } = await db.from("applications").select("id, email, user_id").in("id", c);
      apps.push(...(a ?? []));
    }
    const people: MailPerson[] = [];
    const personFor = (appIds: string[], profIds: string[]) => {
      const ids = new Set<string>([...appIds, ...profIds]);
      for (const p of profs) if (ids.has(p.id) || (p.application_id && ids.has(p.application_id))) { ids.add(p.id); if (p.application_id) ids.add(p.application_id); }
      for (const a of apps) if (ids.has(a.id) || (a.user_id && ids.has(a.user_id))) { ids.add(a.id); if (a.user_id) ids.add(a.user_id); }
      const emails = apps.filter((a) => ids.has(a.id) && a.email).map((a) => String(a.email).toLowerCase());
      return { ids: [...ids], emails };
    };
    for (const id of data.applicationIds) people.push({ id, ...personFor([id], []) });
    for (const id of data.profileIds) people.push({ id, ...personFor([], [id]) });
    const allIds = [...new Set(people.flatMap((p) => p.ids))];
    const allEmails = [...new Set(people.flatMap((p) => p.emails))];
    const rows: any[] = []; const seenRow = new Set<string>();
    const add = (r: any[] | null) => { for (const m of r ?? []) if (!seenRow.has(m.id)) { seenRow.add(m.id); rows.push(m); } };
    for (const col of ["application_id", "profile_id"]) for (const c of chunks(allIds)) {
      const { data: r, error } = await db.from("lead_messages").select(cols).eq("direction", "out").in(col, c).order("created_at", { ascending: false }).limit(2000);
      if (error) throw new Error(error.message); add(r);
    }
    for (const c of chunks(allEmails)) {
      const { data: r, error } = await db.from("lead_messages").select(cols).eq("direction", "out").in("peer_email", c).order("created_at", { ascending: false }).limit(2000);
      if (error) throw new Error(error.message); add(r);
    }
    const { latest, byPerson } = matchMailsToPeople(rows, people);
    const seen = new Set<string>();
    const all = data.full ? Object.values(byPerson).flat().filter((m: any) => !seen.has(m.id) && seen.add(m.id)).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)) : [];
    return { latest, all };
  });

export const syncInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { syncReceivedEmails } = await import("./lead-mailing.server");
    return syncReceivedEmails(15);
  });

/** Signierter Download-Link für einen Postfach-Anhang (nur Admins). */
export const getMailAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().min(3).max(400).regex(/^(in|out)\//) }).parse(i))
  .handler(async ({ data, context }) => {
    const access = await requireMailAccess(context);
    if (access === "caller") {
      const { data: rows } = await (context.supabase as any).from("lead_messages").select("id")
        .filter("attachments", "cs", JSON.stringify([{ path: data.path }])).limit(1);
      if (!rows?.length) throw new Error("Nicht autorisiert");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await (supabaseAdmin as any).storage.from("mail-attachments").createSignedUrl(data.path, 300);
    if (error || !signed?.signedUrl) throw new Error(`Anhang nicht verfügbar: ${error?.message ?? "unbekannt"}`);
    return { url: signed.signedUrl as string };
  });
