# Postfach-Anhänge, Chat-Sortierung, Handy-Ansicht

## 1. Anhänge im Postfach (zuerst)
Heute kann das Postfach weder Anhänge senden noch empfangene Anhänge zeigen.
- **Senden:** Im Fenster „Neue Mail“ und beim Antworten gibt es einen Knopf „Datei anhängen“ (PDF, Bilder, Word; bis 10 MB pro Mail). So kannst du z. B. den Vertrag als PDF verschicken.
- **Empfangen:** Kommt eine Mail mit Anhang an, erscheint er unter der Nachricht zum Öffnen und Herunterladen.
- Jede Mail mit Anhang bleibt wie bisher im Verlauf der Person gespeichert.

## 2. Chat-Liste: Aktive oben, Inaktive unten
- Sortierung nach „zuletzt aktiv“: wer gerade aktiv war oben, wer lange oder nie aktiv war bzw. gesperrt ist unten.
- Eskalierte Chats und Chats mit offener Antwort bleiben ganz oben.

## 3. Handy-Ansicht
- Zuerst die wichtigsten Seiten auf dem Handy prüfen (Login, Dashboard, Chat, Postfach, Mitarbeiter, Bewerber) und Screenshots machen.
- Dann die schlimmsten Stellen beheben: abgeschnittene Tabellen, zu breite Zeilen, Knöpfe übereinander, zu kleine Schrift.
- Danach zeige ich dir eine Liste mit Vorher/Nachher.

## Technische Details
- Anhänge senden: Dateien als base64 an `sendPortalMail` übergeben und an Resend `attachments` weiterreichen; Größe und Dateityp serverseitig prüfen. Speicherung in einem privaten Storage-Bucket, Verweis an `lead_messages` (neue Spalte `attachments` jsonb).
- Anhänge empfangen: im Resend-Inbound-Webhook bzw. Receiving-Sync die Anhänge abrufen, in denselben Bucket legen und verlinken; Download nur für Admins über signierte Links.
- Chat-Sortierung in `src/routes/admin.chat.tsx` nach `refreshActivity` anwenden, mit kleinem Test der Regel.
- Handy: Prüfung mit 390 px Breite; Tabellen auf Karten bzw. horizontales Scrollen umstellen, Kopfzeilen nach dem Grid-Muster mit `min-w-0`/`shrink-0`.
