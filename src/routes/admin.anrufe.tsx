import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Search, CalendarPlus, PhoneCall } from "lucide-react";
import { CALL_STATUSES, callStatusLabel, isCallToday, nextAppointment, type CallStatus } from "@/lib/call-list";
import { CallAppointmentDialog, CallLogDialog } from "@/components/calls/CallDialogs";

export const Route = createFileRoute("/admin/anrufe")({
  head: () => ({ meta: [
    { title: "Anruf-Liste – Admin-Portal" },
    { name: "description", content: "Telefontermine und Gesprächsstand aller dem Caller zugewiesenen Bewerber und Mitarbeiter." },
    { property: "og:title", content: "Anruf-Liste – Admin-Portal" },
    { property: "og:description", content: "Telefontermine und Gesprächsstand für Caller." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AnrufListePage,
});

type Appt = { id: string; application_id: string; scheduled_at: string; note: string | null; done: boolean };
type Row = {
  id: string; name: string; phone: string | null; email: string | null; employee: boolean;
  status: CallStatus; note: string | null; last_call_at: string | null; next: Appt | null;
};
const db = supabase as any;
const fmt = (iso: string) => new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

function AnrufListePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [tab, setTab] = useState<"termine" | "personen">("termine");
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all" | "today">("all");
  const [q, setQ] = useState("");
  const [apptFor, setApptFor] = useState<Row | null>(null);
  const [logFor, setLogFor] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data: apps, error } = await db.from("applications").select("id, full_name, phone, email, user_id").eq("contact_marker", "green").order("full_name");
    if (error) { setRows([]); return; }
    const ids = (apps ?? []).map((a: any) => a.id);
    const userIds = (apps ?? []).map((a: any) => a.user_id).filter(Boolean);
    const [st, ap, pr] = await Promise.all([
      ids.length ? db.from("call_status").select("*").in("application_id", ids) : { data: [] },
      ids.length ? db.from("call_appointments").select("*").in("application_id", ids).eq("done", false).order("scheduled_at") : { data: [] },
      ids.length ? db.from("profiles").select("user_id, application_id, phone").or([`application_id.in.(${ids.join(",")})`, userIds.length ? `user_id.in.(${userIds.join(",")})` : ""].filter(Boolean).join(",")) : { data: [] },
    ]);
    const stBy = new Map((st.data ?? []).map((s: any) => [s.application_id, s]));
    const profFor = (a: any) => (pr.data ?? []).find((p: any) => p.application_id === a.id || (a.user_id && p.user_id === a.user_id));
    const allAppts: Appt[] = ap.data ?? [];
    setAppts(allAppts);
    setRows((apps ?? []).map((a: any): Row => {
      const s: any = stBy.get(a.id);
      const p: any = profFor(a);
      return {
        id: a.id, name: a.full_name, phone: p?.phone || a.phone || null, email: a.email ?? null, employee: !!p,
        status: (s?.status ?? "neu") as CallStatus, note: s?.note ?? null, last_call_at: s?.last_call_at ?? null,
        next: nextAppointment(allAppts.filter((x) => x.application_id === a.id)),
      };
    }));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (statusFilter === "all" || (statusFilter === "today" ? isCallToday(r.status, r.next) : r.status === statusFilter))
    && (!q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.phone ?? "").includes(q))), [rows, statusFilter, q]);
  const upcoming = useMemo(() => appts.filter((a) => byId.has(a.application_id) && new Date(a.scheduled_at).getTime() >= Date.now() - 3600_000), [appts, byId]);
  const days = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of upcoming) {
      const k = new Date(a.scheduled_at).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.entries()];
  }, [upcoming]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">Anruf-Liste</h1>
        <p className="text-sm text-muted-foreground mt-1">Alle grün markierten Personen mit Telefonterminen und Gesprächsstand.</p>
      </div>
      <div className="flex gap-2">
        <Button variant={tab === "termine" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("termine")}><span>Telefon-Termine ({upcoming.length})</span></Button>
        <Button variant={tab === "personen" ? "default" : "outline"} className="rounded-full" onClick={() => setTab("personen")}><span>Alle Personen ({rows?.length ?? 0})</span></Button>
      </div>

      {rows === null && <Loader2 className="h-5 w-5 animate-spin" />}

      {rows && tab === "termine" && (
        days.length === 0 ? <p className="text-sm text-muted-foreground">Keine anstehenden Telefontermine.</p> : (
          <div className="space-y-5">
            {days.map(([day, list]) => (
              <div key={day} className="space-y-2">
                <h2 className="text-sm font-semibold">{day}</h2>
                {list.map((a) => {
                  const r = byId.get(a.application_id)!;
                  return (
                    <div key={a.id} className="rounded-2xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
                      <div className="text-sm font-semibold w-14">{new Date(a.scheduled_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{r.name} <span className="text-xs text-muted-foreground">· {r.employee ? "Mitarbeiter" : "Bewerber"}</span></div>
                        {a.note && <div className="text-xs text-muted-foreground truncate">{a.note}</div>}
                      </div>
                      {r.phone && <a href={telHref(r.phone)} className="inline-flex items-center gap-1.5 text-sm text-primary"><Phone className="h-4 w-4" /><span>{r.phone}</span></a>}
                      <Button size="sm" className="rounded-full gap-1.5" onClick={() => setLogFor(r)}><PhoneCall className="h-4 w-4" /><span>Anruf eintragen</span></Button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )
      )}

      {rows && tab === "personen" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {([{ key: "all", label: "Alle" }, { key: "today", label: "Heute anrufen" }, ...CALL_STATUSES] as { key: string; label: string }[]).map((s) => (
              <Button key={s.key} size="sm" variant={statusFilter === s.key ? "default" : "outline"} className="rounded-full" onClick={() => setStatusFilter(s.key as any)}><span>{s.label}</span></Button>
            ))}
          </div>
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 rounded-full" placeholder="Name oder Telefon suchen" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Keine Personen. Markiere Bewerber oder Mitarbeiter grün, damit sie hier erscheinen.</p> : (
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {filtered.map((r) => (
                <div key={r.id} className="p-3 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.employee ? "Mitarbeiter" : "Bewerber"}{r.phone ? <> · <a className="text-primary" href={telHref(r.phone)}>{r.phone}</a></> : ""}</div>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Nächster Termin: </span>{r.next ? fmt(r.next.scheduled_at) : "–"}</div>
                  <Badge variant="secondary" className="w-fit">{callStatusLabel(r.status)}</Badge>
                  <div className="text-xs text-muted-foreground min-w-0">
                    <div>Letzter Anruf: {r.last_call_at ? fmt(r.last_call_at) : "–"}</div>
                    {r.note && <div className="truncate">{r.note}</div>}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setApptFor(r)}><CalendarPlus className="h-4 w-4" /><span>Termin</span></Button>
                    <Button size="sm" className="rounded-full gap-1.5" onClick={() => setLogFor(r)}><PhoneCall className="h-4 w-4" /><span>Anruf</span></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CallAppointmentDialog open={!!apptFor} onOpenChange={(o) => !o && setApptFor(null)} applicationId={apptFor?.id ?? null} name={apptFor?.name ?? ""} onSaved={load} />
      {logFor && <CallLogDialog open onOpenChange={(o) => !o && setLogFor(null)} applicationId={logFor.id} name={logFor.name} onSaved={load} />}
    </div>
  );
}
