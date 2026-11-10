import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({
  user_id: z.string().uuid(),
  origin: z.string().url().max(200),
});

/** Admin-only: erzeugt einen einmaligen Passwort-Reset-Link für einen Mitarbeiter. */
export const createPasswordResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: role, error: roleErr } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!role) throw new Error("Nicht autorisiert");

    const origin = new URL(data.origin).origin;
    if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) {
      throw new Error("Ungültige Adresse");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: u, error: uErr } = await sb.auth.admin.getUserById(data.user_id);
    if (uErr || !u?.user?.email) throw new Error("Kein Konto mit E-Mail gefunden");

    const { data: link, error } = await sb.auth.admin.generateLink({
      type: "recovery",
      email: u.user.email,
      options: { redirectTo: `${origin}/reset-password` },
    });
    if (error) throw new Error(error.message);
    const hashed = link?.properties?.hashed_token;
    if (!hashed) throw new Error("Link konnte nicht erzeugt werden");
    return { url: `${origin}/reset-password?token_hash=${encodeURIComponent(hashed)}&type=recovery` };
  });
