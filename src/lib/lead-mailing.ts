// Reine Helfer für das Lead-Mailing (CSV-Import, Vorlage, Tageslimit).
// Keine Server-Abhängigkeiten → testbar und im Browser nutzbar.

export type LeadRow = { firstName: string; lastName: string; email: string; phone: string | null };

export const DEFAULT_LEAD_SUBJECT = "Ihre Bewerbung bei {Firma} – nächster Schritt";
export const DEFAULT_LEAD_BODY = `Guten Tag {Vorname} {Nachname},

vielen Dank für Ihre Bewerbung über Indeed. Wir freuen uns, Ihnen mitzuteilen, dass Sie in die engere Auswahl aufgenommen wurden.

Bitte registrieren Sie sich auf unserer Website {Homepage} und wählen Sie anschließend über Calendly einen Termin für Ihr Interview: {Calendly}

Bei Fragen antworten Sie einfach auf diese E-Mail.

Freundliche Grüße
{Absender}
{Firma}`;

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-zäöüß]/g, "");
const FIRST = ["vorname", "firstname", "first", "givenname"];
const LAST = ["nachname", "lastname", "last", "surname", "familyname", "familienname"];
const FULL = ["name", "fullname", "kandidat", "candidate", "candidatename", "bewerber", "vollständigername"];
const MAIL = ["email", "emailadresse", "mail", "emailaddress", "candidateemail"];
const PHONE = ["telefon", "phone", "telefonnummer", "phonenumber", "mobil", "handy"];

/** Liest einen Indeed-CSV-Export (Komma oder Semikolon). Entfernt ungültige Mails und Dubletten. */
export function parseLeadCsv(text: string): { rows: LeadRow[]; invalid: number; duplicates: number } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], invalid: 0, duplicates: 0 };
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], sep).map(norm);
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iFirst = idx(FIRST), iLast = idx(LAST), iFull = idx(FULL), iMail = idx(MAIL), iPhone = idx(PHONE);
  if (iMail < 0) throw new Error("Keine E-Mail-Spalte gefunden (z. B. „E-Mail“ oder „Email“).");
  const seen = new Set<string>();
  const rows: LeadRow[] = [];
  let invalid = 0, duplicates = 0;
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line, sep);
    const email = (cols[iMail] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { invalid++; continue; }
    if (seen.has(email)) { duplicates++; continue; }
    seen.add(email);
    let firstName = iFirst >= 0 ? cols[iFirst] ?? "" : "";
    let lastName = iLast >= 0 ? cols[iLast] ?? "" : "";
    if (!firstName && !lastName && iFull >= 0) {
      const parts = (cols[iFull] ?? "").trim().split(/\s+/);
      firstName = parts.shift() ?? "";
      lastName = parts.join(" ");
    }
    rows.push({ firstName: firstName.trim(), lastName: lastName.trim(), email, phone: iPhone >= 0 ? cols[iPhone]?.trim() || null : null });
  }
  return { rows, invalid, duplicates };
}

export type TemplateVars = {
  Vorname?: string; Nachname?: string; Firma?: string; Homepage?: string; Calendly?: string; Absender?: string;
};

export function renderLeadTemplate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{(Vorname|Nachname|Firma|Homepage|Calendly|Absender)\}/g, (_, k: keyof TemplateVars) => (vars[k] ?? "").trim())
    .replace(/[ \t]+,/g, ",").replace(/Guten Tag ,/g, "Guten Tag,");
}

/**
 * Wie viele Mails dürfen JETZT noch raus? Versand nur 08–20 Uhr (Berlin),
 * gleichmäßig über das Fenster verteilt, nie mehr als das Tageslimit.
 */
export function allowedToSendNow(dailyLimit: number, sentToday: number, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const minutes = h * 60 + m;
  const start = 8 * 60, end = 20 * 60;
  if (minutes < start || minutes >= end) return 0;
  const fraction = (minutes - start + 10) / (end - start);
  const target = Math.min(dailyLimit, Math.ceil(dailyLimit * Math.min(1, fraction)));
  return Math.max(0, target - sentToday);
}

/** Abmeldewunsch in einer Antwort erkennen. */
export function isUnsubscribeReply(subject: string, body: string): boolean {
  // Nur der neue Antworttext zählt, kein zitierter Verlauf.
  const fresh = body.split(/\n\s*>|\n.*(?:schrieb|wrote).*:|\n-{2,}\s*(?:Original|Ursprüngliche)/i)[0];
  const t = `${subject}\n${fresh}`.toLowerCase();
  return /\b(bitte\s+(?:abmelden|austragen|löschen\s+sie\s+mich)|abmeldung|unsubscribe|melden\s+sie\s+mich\s+ab|keine\s+weiteren\s+(?:e-?mails|nachrichten)\s+(?:mehr\s+)?(?:senden|schicken|zusenden))\b/.test(t);
}

/** Nur dauerhafte Rückläufer sperren (Adresse existiert nicht), keine vollen Postfächer. */
export function isPermanentBounce(bounce: { type?: string | null } | null | undefined): boolean {
  const t = String(bounce?.type ?? "").toLowerCase();
  return t === "permanent" || t === "hard";
}

export const MAIL_BLOCK_PREFIX = "MAIL_BLOCKED:";

export function mailBlockMessage(status: string, error: string | null): string {
  const why = status === "bounced" ? "Die Adresse existiert nicht (Mail kam dauerhaft zurück)."
    : error === "email.complained" ? "Die Person hat eine frühere Mail als Spam markiert."
    : "Die Person hat per Antwort um Abmeldung gebeten.";
  return `${MAIL_BLOCK_PREFIX} ${why}`;
}
