# Gesendete Mails anzeigen und Mail-Hinweis bei Bewerbern/Mitarbeitern zuverlässig machen

## Antwort auf deine Fragen
- **Gesendete Mails:** Sie werden schon gespeichert, aber nur im jeweiligen Gespräch angezeigt. Einen eigenen Reiter „Gesendet“ gibt es nicht.
- **Ist die Anzeige bei Bewerbern/Mitarbeitern aktuell?** Nicht immer. Der Hinweis „Mail gesendet / geöffnet“ wird nur gefunden, wenn die Mail direkt an diesem Eintrag hing. Fehlende Fälle:
  - Mail aus dem Postfach direkt an eine Adresse geschrieben (ohne Personen-Zuordnung).
  - Bewerber wurde später Mitarbeiter: frühere Mails hängen an der Bewerbung, nicht am Mitarbeiter (und umgekehrt).
  - Gleiche Person mit mehreren Bewerbungen.

## Was gebaut wird
1. **Neuer Reiter „Gesendet“ im Postfach:** Liste aller von euch verschickten Mails, neueste oben, mit Empfänger, Betreff, Datum, Status (gesendet / zugestellt / geöffnet / unzustellbar) und Anhängen. Klick öffnet das Gespräch. Suche nach Name/Adresse.
2. **Mail-Hinweis bei Bewerbern und Mitarbeitern korrigieren:** Mails werden zusätzlich über die **E-Mail-Adresse** und die Verknüpfung Bewerbung ↔ Mitarbeiter gefunden. So erscheint jede an die Person gesendete Mail – egal von wo verschickt.
3. **Aktualität:** Nach dem Senden und beim Zurückkehren auf die Liste wird der Status neu geladen.
4. Mit den Testdaten im Live-Portal prüfen (nur lesen, nichts verschicken).

## Technische Details
- `listMailThreads` bekommt Filter `sent` (direction = out, flache Liste statt Threads).
- Status-Abfrage (`getMailStatus…`, ca. Zeile 405 in `lead-mailing.functions.ts`): zusätzlich E-Mails der Bewerbungen/Profile sammeln, `peer_email` (lowercase) abfragen, Bewerbung↔Profil über `profiles.application_id` / `applications.user_id` zusammenführen; Ergebnis je ID zusammengeführt.
- Test: Mail ohne application_id, aber gleicher Adresse, erscheint bei Bewerber und Mitarbeiter.
