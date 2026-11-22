# Caller-Konto, Termine und Anruf-Liste

## 1. Eigenes Caller-Konto
- Unter **Admin → Konten** legst du ein Konto an, z. B. `caller@caller.de` mit Passwort. Neue Kontoart: **Caller**.
- Der Caller meldet sich ganz normal im Portal an und sieht nur seine Seiten: **Bewerbungen, Mitarbeiter, Chat, Postfach, Anruf-Liste**. Einstellungen, Landing Pages, Firmen usw. sieht er nicht.

## 2. Grün = „gehört dem Caller“
- Die bisherige Markierung bleibt. **Grün** bedeutet ab jetzt „dem Caller zugewiesen“. Blau fällt weg.
- Markierst du z. B. Ali Usman grün, sieht der Caller:
  - Ali Usman in **Bewerbungen**
  - Ali Usman in **Mitarbeiter**, sobald er sich als Mitarbeiter registriert (die Markierung wandert automatisch mit)
  - den **Chat** mit Ali Usman
  - im **Postfach** den Mailverkehr mit Ali Usman
- Alle anderen Personen sind für den Caller unsichtbar. Er kann bei seinen Personen im Chat und per Mail antworten.
- Nimmst du die Markierung weg, verschwindet die Person sofort beim Caller.

## 3. Telefontermine (getrennt von den Auftrags-Terminen)
Die bestehende Terminseite für Aufträge bleibt unverändert, und der Caller sieht sie **nicht**. Telefontermine gibt es an zwei Stellen:
- **Im Postfach:** Über jeder Mail steht der Knopf **„Termin anlegen“**. Ein Klick öffnet ein kleines Fenster mit der Person schon ausgewählt: Datum, Uhrzeit, Notiz. So legst du den in der Mail ausgemachten Termin direkt an.
- **In der Anruf-Liste** (siehe 4): Dort können Termine ebenfalls angelegt und verschoben werden.
- Der Termin erscheint danach bei der Person in der Anruf-Liste als „Nächster Termin“, und ihr Stand springt auf „Termin vereinbart“.

## 4. Anruf-Liste mit Stand
Eine neue Seite **„Anruf-Liste“** für Caller und Admin, eine Zeile pro Person:

Oben gibt es zwei Reiter: **„Telefon-Termine“** (alle anstehenden Termine nach Tag und Uhrzeit, Telefonnummer zum Anklicken) und **„Alle Personen“**.

| Name | Bewerber/Mitarbeiter | Nächster Termin | Stand | Letzter Anruf | Notiz |

- **Stand** zum Auswählen: Neu · Termin vereinbart · Nicht erreicht · Rückruf · Interessiert · Macht mit · Kein Interesse.
- Nach jedem Anruf trägt der Caller ein: Ergebnis, kurze Notiz, ggf. nächster Termin. Daraus entsteht pro Person ein **Verlauf**, z. B. „20.11. nicht erreicht → 21.11. Rückruf → 22.11. macht mit“.
- Filter nach Stand und „heute anrufen“. Du als Admin siehst denselben Stand in der Bewerber- und Mitarbeiter-Ansicht.

## Technische Details
- Rolle `caller` in `app_role`, Zuweisung über die bestehende `applications.contact_marker = 'green'`. Personen werden wie bisher über `profiles.application_id` / `applications.user_id` aufgelöst. Security-definer-Funktion `caller_can_see_application(app_id)` / `caller_can_see_user(user_id)`.
- RLS für `caller` auf applications, profiles, chat_conversations, chat_messages, lead_messages (über application_id/profile_id/peer_email der zugewiesenen Personen) und Termine. Postfach-Serverfunktionen lassen `caller` zu und filtern serverseitig. Senden geht nur an Adressen der zugewiesenen Personen.
- Neue Tabellen `call_status` (application_id, status, next_call_at) und `call_log` (application_id, caller_id, result, note, created_at) mit GRANTs und RLS. Neue Tabelle `call_appointments` (application_id, scheduled_at, note, created_by, done), getrennt von den bestehenden Buchungen, damit der Caller keine Auftragstermine sieht. Gemeinsamer Dialog „Termin anlegen“ für Postfach und Anruf-Liste.
- Seitenleiste und Login leiten den Caller auf seine Seiten. Blau wird aus der Markierungs-Auswahl entfernt.
- Tests: Caller sieht nur grüne Personen (inklusive Bewerber → Mitarbeiter); Senden an eine fremde Adresse wird abgelehnt; der Stand wird korrekt fortgeschrieben.
