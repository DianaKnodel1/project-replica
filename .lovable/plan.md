# Chat-Liste: Aktive oben, Inaktive unten

## Was sich ändert
Die Chat-Liste wird danach sortiert, wann der Mitarbeiter zuletzt im Portal aktiv war (die Anzeige „Aktiv vor X Min“):
- Ganz oben: wer gerade bzw. zuletzt aktiv war.
- Danach absteigend nach „zuletzt aktiv“.
- Ganz unten: wer lange nicht oder noch nie aktiv war, sowie gesperrte Mitarbeiter.

Eskalierte Chats und Chats mit offener Antwort bleiben trotzdem ganz oben, damit nichts übersehen wird. Darunter gilt die neue Reihenfolge.

Die Reiter „Aktiv“ und „Ausgeblendet“ und alle Filter bleiben wie sie sind.

## Technische Details
- In `src/routes/admin.chat.tsx` die Sortierung nach dem Laden von `last_seen_at` (refreshActivity) anwenden, nicht nur beim ersten Laden.
- Reihenfolge: eskaliert → offene Antwort → `last_seen_at` absteigend → ohne Wert bzw. gesperrt am Ende.
- Kleiner Test für die Sortierregel in `src/test/`.
