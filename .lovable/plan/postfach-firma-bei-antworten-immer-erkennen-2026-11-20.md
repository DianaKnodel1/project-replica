# Postfach: Firma bei Antworten immer erkennen

## Warum es passiert ist
Bei einer eingehenden Mail sucht das Portal die Firma nur so:
1. Gab es schon eine **vom Portal gesendete** Mail an genau diese Adresse?
2. Sonst: Gibt es einen **Lead** (aus Lead-Mailing) mit genau dieser Adresse?

Im Beispiel passt beides nicht:
- Die Absenderin schreibt von `@googlemail.com`. Bei uns ist sie vermutlich als `@gmail.com` gespeichert. Das ist dasselbe Postfach, aber für das Portal eine andere Adresse.
- Ist sie eine normale Bewerberin und kein Lead, wird sie in Schritt 2 gar nicht gesucht.
- Die Mail ging an `info@bewerbung.bcu-beratung.com`. Die Firma steht also schon in der Empfängeradresse, aber diese Adresse wird bisher nicht ausgewertet.

Deshalb steht der Verlauf auf „Extern“ ohne Firma, und „Antwort senden“ wird gesperrt.

## Was ich ändere
1. **Firma über die Empfängeradresse:** Ging die Mail an eine Absenderadresse oder Domain einer Firma (z. B. `bcu-beratung.com`), wird diese Firma zugeordnet. Das ist die sicherste Erkennung.
2. **gmail = googlemail:** Beide Schreibweisen gelten beim Zuordnen als dieselbe Adresse.
3. **Alle Bewerber und Mitarbeiter suchen**, nicht nur Leads.
4. **Alte Verläufe nachbessern:** Bestehende Verläufe ohne Firma werden einmal nach denselben Regeln zugeordnet.
5. **Notfall im Postfach:** Fehlt trotzdem eine Firma, zeigt der Antwortbereich ein Auswahlfeld „Firma wählen“ statt einer Fehlermeldung. Du kannst dann direkt antworten.

## Technische Details
- `lead-mailing.server.ts` (Mail-Eingang): Tenant aus `to`-Adressen über `lead_mail_settings.sender_email` (exakt, dann Domain bzw. Subdomain). Adressen normalisieren (`googlemail.com` → `gmail.com`, Kleinschreibung). Applications ohne `lead_source`-Filter, dazu Abgleich über Profile.
- Gemeinsame Hilfsfunktion `normalizeMailAddress` / `resolveTenantFromRecipient` in `lead-mailing.ts` mit Tests (gmail/googlemail, Subdomain `bewerbung.bcu-beratung.com` → BCU).
- Manuelle Migration bzw. Admin-Funktion: `lead_messages` mit `tenant_id IS NULL` über `to_email` nachtragen.
- `admin.postfach.tsx`: Fehlt `tenant_id`, Firmen-Auswahl im Antwortbereich (gleiche Liste wie bei „Neue Nachricht“).
