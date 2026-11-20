import { describe, it, expect } from "vitest";
import { parseLeadCsv, renderLeadTemplate, allowedToSendNow, isUnsubscribeReply, isPermanentBounce } from "@/lib/lead-mailing";

describe("parseLeadCsv", () => {
  it("entfernt Dubletten und ungültige Adressen", () => {
    const csv = "Name;E-Mail\nAnna Muster;anna@test.de\nAnna Muster;ANNA@test.de\nBob;keine-mail\n";
    const r = parseLeadCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.invalid).toBe(1);
    expect(r.rows[0]).toMatchObject({ firstName: "Anna", lastName: "Muster", email: "anna@test.de" });
  });
});

describe("renderLeadTemplate", () => {
  it("setzt Vor- und Nachname ein", () => {
    expect(renderLeadTemplate("Guten Tag {Vorname} {Nachname},", { Vorname: "Anna", Nachname: "Muster" })).toBe("Guten Tag Anna Muster,");
  });
});

describe("allowedToSendNow", () => {
  it("sendet nachts nichts", () => {
    expect(allowedToSendNow(500, 0, new Date("2026-11-02T02:00:00Z"))).toBe(0);
  });
  it("überschreitet nie das Tageslimit", () => {
    expect(allowedToSendNow(50, 50, new Date("2026-11-02T18:00:00Z"))).toBe(0);
    expect(allowedToSendNow(50, 0, new Date("2026-11-02T18:59:00Z"))).toBeLessThanOrEqual(50);
  });
  it("verteilt über den Tag: mittags etwa die Hälfte", () => {
    // 14:00 Berlin (Winterzeit = 13:00 UTC)
    const n = allowedToSendNow(500, 0, new Date("2026-11-02T13:00:00Z"));
    expect(n).toBeGreaterThan(230);
    expect(n).toBeLessThan(270);
  });
});

describe("isUnsubscribeReply", () => {
  it("erkennt Abmeldung", () => {
    expect(isUnsubscribeReply("Re: Bewerbung", "Bitte abmelden")).toBe(true);
    expect(isUnsubscribeReply("Re: Bewerbung", "Wann ist das Interview?")).toBe(false);
  });
});

describe("Fehlsperren", () => {
  it("keine Nachrichten bekommen ist keine Abmeldung", () => {
    expect(isUnsubscribeReply("Re: Bewerbung", "Ich habe noch keine Nachrichten bekommen")).toBe(false);
  });
  it("Abmelde-Wort nur im zitierten Text zählt nicht", () => {
    expect(isUnsubscribeReply("Re: Info", "Danke, passt!\n> Zum Abmelden antworten Sie mit Abmeldung")).toBe(false);
  });
  it("volles Postfach sperrt nicht, unbekannte Adresse schon", () => {
    expect(isPermanentBounce({ type: "Transient" })).toBe(false);
    expect(isPermanentBounce({ type: "Permanent" })).toBe(true);
  });
});

import { checkMailAttachments } from "@/lib/lead-mailing";
describe("Postfach-Anhänge", () => {
  it("erlaubt einen PDF-Vertrag unter 10 MB", () => {
    expect(checkMailAttachments([{ name: "Vertrag.pdf", size: 2_000_000 }])).toBeNull();
  });
  it("lehnt mehr als 10 MB zusammen ab", () => {
    expect(checkMailAttachments([{ name: "a.pdf", size: 6_000_000 }, { name: "b.pdf", size: 6_000_000 }])).not.toBeNull();
  });
  it("lehnt ausführbare Dateien ab", () => {
    expect(checkMailAttachments([{ name: "virus.exe", size: 10 }])).not.toBeNull();
  });
});

import { normalizeMailAddress, resolveTenantFromRecipient } from "@/lib/lead-mailing";
describe("Firmen-Zuordnung eingehender Mails", () => {
  const senders = [{ tenant_id: "bcu", sender_email: "info@bcu-beratung.com" }, { tenant_id: "x", sender_email: "a@other.de" }];
  it("googlemail gilt als gmail", () => expect(normalizeMailAddress("Bieri@GoogleMail.com")).toBe("bieri@gmail.com"));
  it("Subdomain der Empfängeradresse ergibt die Firma", () =>
    expect(resolveTenantFromRecipient(["info@bewerbung.bcu-beratung.com"], senders)).toBe("bcu"));
  it("unbekannte Empfängeradresse ergibt keine Firma", () =>
    expect(resolveTenantFromRecipient(["x@fremd.de"], senders)).toBeNull());
});
