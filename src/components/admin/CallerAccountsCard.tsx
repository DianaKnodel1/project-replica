import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PhoneCall, Trash2 } from "lucide-react";
import { listStaffAccounts, createStaffAccount, revokeStaffAccount } from "@/lib/staff-accounts.functions";

type Account = { user_id: string; email: string; full_name: string };

/** Caller-Konten: sehen nur grün markierte Personen, deren Chat, Postfach und die Anruf-Liste. */
export function CallerAccountsCard() {
  const listFn = useServerFn(listStaffAccounts);
  const createFn = useServerFn(createStaffAccount);
  const revokeFn = useServerFn(revokeStaffAccount);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    setLoading(true);
    try { setAccounts((await listFn({ data: { role: "caller" } })).accounts); }
    catch (e: any) { toast.error(e?.message ?? "Konten konnten nicht geladen werden."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setSaving(true);
    try {
      await createFn({ data: { full_name: fullName.trim(), email: email.trim(), password, role: "caller" } });
      toast.success(`${email.trim()} kann sich jetzt als Caller anmelden.`);
      setFullName(""); setEmail(""); setPassword("");
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Konto konnte nicht angelegt werden."); }
    finally { setSaving(false); }
  };

  const revoke = async (a: Account) => {
    if (!window.confirm(`Caller-Zugang für ${a.email || a.full_name} entfernen?`)) return;
    try { await revokeFn({ data: { user_id: a.user_id, role: "caller" } }); await load(); }
    catch (e: any) { toast.error(e?.message ?? "Konnte nicht entfernt werden."); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><PhoneCall className="h-4 w-4" /> Caller-Konten</CardTitle>
        <CardDescription>Ein Caller sieht nur Personen, die du grün markierst: Bewerbung, Mitarbeiter, Chat, Postfach und Anruf-Liste.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Wird geladen…</p>
            : accounts.length === 0 ? <p className="text-sm text-muted-foreground">Noch kein Caller angelegt.</p>
            : accounts.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.full_name || "Ohne Namen"}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(a)} className="gap-1.5 shrink-0"><Trash2 className="h-3.5 w-3.5" /> Entfernen</Button>
              </div>
            ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1"><Label htmlFor="caller-name">Name</Label><Input id="caller-name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="caller-email">E-Mail</Label><Input id="caller-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="caller@caller.de" /></div>
          <div className="space-y-1"><Label htmlFor="caller-pw">Passwort (mind. 8 Zeichen)</Label><Input id="caller-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        <Button onClick={create} disabled={saving || !fullName.trim() || !email.trim() || password.length < 8}>
          <span>{saving ? "Wird angelegt …" : "Caller anlegen"}</span>
        </Button>
      </CardContent>
    </Card>
  );
}
