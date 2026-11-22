import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CALL_RESULTS, historyLine, statusAfterAppointment, statusAfterCall, type CallStatus } from "@/lib/call-list";

const db = supabase as any;

/** Löst die Bewerbung zu einem Mitarbeiterprofil auf (Termine/Stand hängen an der Bewerbung). */
export async function resolveApplicationId(applicationId?: string | null, profileId?: string | null): Promise<string | null> {
  if (applicationId) return applicationId;
  if (!profileId) return null;
  const { data: p } = await db.from("profiles").select("application_id, user_id").eq("id", profileId).maybeSingle();
  if (p?.application_id) return p.application_id;
  if (!p?.user_id) return null;
  const { data: a } = await db.from("applications").select("id").eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return a?.id ?? null;
}

async function setStatus(applicationId: string, patch: Record<string, unknown>) {
  const { error } = await db.from("call_status").upsert({ application_id: applicationId, updated_at: new Date().toISOString(), ...patch }, { onConflict: "application_id" });
  if (error) throw new Error(error.message);
}

export async function createCallAppointment(applicationId: string, when: string, note: string, userId: string | null) {
  const { error } = await db.from("call_appointments").insert({ application_id: applicationId, scheduled_at: new Date(when).toISOString(), note: note || null, created_by: userId });
  if (error) throw new Error(error.message);
  await setStatus(applicationId, { status: statusAfterAppointment(null) });
}

const localNow = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

/** „Termin anlegen“ – aus Postfach und Anruf-Liste. */
export function CallAppointmentDialog({ open, onOpenChange, applicationId, profileId, name, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; applicationId?: string | null; profileId?: string | null; name: string; onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setWhen(""); setNote(""); } }, [open]);
  const save = async () => {
    setSaving(true);
    try {
      const appId = await resolveApplicationId(applicationId, profileId);
      if (!appId) throw new Error("Zu dieser Person gibt es keine Bewerbung im Portal.");
      await createCallAppointment(appId, when, note.trim(), user?.id ?? null);
      toast.success(`Telefontermin mit ${name} angelegt`);
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) { toast.error(e?.message ?? "Termin konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Telefontermin anlegen</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="call-when">Datum und Uhrzeit</Label>
            <Input id="call-when" type="datetime-local" min={localNow()} value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="call-note">Notiz</Label>
            <Textarea id="call-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. ruft lieber nach 17 Uhr an" /></div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !when}><span>{saving ? "Wird gespeichert …" : "Termin speichern"}</span></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Anruf eintragen: Ergebnis, Notiz, optional nächster Termin. Zeigt den bisherigen Verlauf. */
export function CallLogDialog({ open, onOpenChange, applicationId, name, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; applicationId: string; name: string; onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [result, setResult] = useState<CallStatus>("nicht_erreicht");
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [log, setLog] = useState<{ result: string; note: string | null; created_at: string }[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setResult("nicht_erreicht"); setNote(""); setNext("");
    db.from("call_log").select("result, note, created_at").eq("application_id", applicationId).order("created_at", { ascending: false })
      .then((r: any) => setLog(r.data ?? []));
  }, [open, applicationId]);
  const save = async () => {
    setSaving(true);
    try {
      const { error } = await db.from("call_log").insert({ application_id: applicationId, caller_id: user?.id ?? null, result, note: note.trim() || null });
      if (error) throw new Error(error.message);
      await setStatus(applicationId, { status: statusAfterCall(result), note: note.trim() || null, last_call_at: new Date().toISOString() });
      if (next) {
        const { error: e2 } = await db.from("call_appointments").insert({ application_id: applicationId, scheduled_at: new Date(next).toISOString(), note: note.trim() || null, created_by: user?.id ?? null });
        if (e2) throw new Error(e2.message);
      }
      // Erledigte Termine bis jetzt abhaken
      await db.from("call_appointments").update({ done: true }).eq("application_id", applicationId).eq("done", false).lte("scheduled_at", new Date().toISOString());
      toast.success("Anruf gespeichert");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) { toast.error(e?.message ?? "Anruf konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Anruf eintragen</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Ergebnis</Label>
            <div className="flex flex-wrap gap-1.5">
              {CALL_RESULTS.map((r) => (
                <Button key={r.key} type="button" size="sm" variant={result === r.key ? "default" : "outline"} className="rounded-full" onClick={() => setResult(r.key)}>
                  <span>{r.label}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor="log-note">Notiz</Label>
            <Textarea id="log-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="log-next">Nächster Termin (optional)</Label>
            <Input id="log-next" type="datetime-local" min={localNow()} value={next} onChange={(e) => setNext(e.target.value)} /></div>
          {log.length > 0 && (
            <div className="rounded-xl bg-muted p-3 text-xs space-y-1">
              <div className="font-medium">Verlauf</div>
              <div>{historyLine(log)}</div>
              {log.filter((l) => l.note).slice(0, 5).map((l) => (
                <div key={l.created_at} className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString("de-DE")}: {l.note}</div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}><span>{saving ? "Wird gespeichert …" : "Anruf speichern"}</span></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
