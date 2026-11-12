# Fehler „Adresse ist abgemeldet oder nicht zustellbar“ beheben

## Was passiert gerade
Das Postfach sperrt eine Adresse, sobald im Bewerber-Eintrag dieser Person „Abgemeldet“ oder „Unzustellbar“ vermerkt ist. Dieser Vermerk entsteht heute in drei Fällen, auch ohne echte Abmeldung:
1. **Antwort mit bestimmten Wörtern:** Antwortet jemand mit „abmelden“, „Abmeldung“, „keine Nachrichten“ oder „keine E-Mails“, gilt das schon als Abmeldung. Ein Beispiel wäre „ich habe noch keine Nachrichten bekommen“.
2. **Kurzzeitige Zustellprobleme:** Ein voller Posteingang oder ein kurz nicht erreichbarer Mailserver zählt genauso wie eine Adresse, die es nicht gibt.
3. **Spam-Meldung:** Markiert der Empfänger eine Mail als Spam, wird er als „abgemeldet“ geführt.

Außerdem sagt der Fehler nicht, welcher Grund zutrifft, und der Vermerk lässt sich nicht aufheben.

## Änderungen
- **Abmelde-Erkennung strenger machen:** Nur noch eindeutige Sätze wie „bitte abmelden“, „Abmeldung“ oder „unsubscribe“ und nur im neuen Antworttext. „keine Nachrichten“ oder „keine E-Mails“ allein zählt nicht mehr.
- **Nur echte Unzustellbarkeit sperren:** Volle Postfächer und kurze Serverprobleme sperren nicht mehr. Gesperrt wird nur, wenn es die Adresse dauerhaft nicht gibt.
- **Klarere Meldung:** Der Fehler nennt den Grund, also abgemeldet per Antwort, als Spam gemeldet oder Adresse existiert nicht, mit Datum.
- **Sperre aufheben:** Bei so einem Fehler kann der Admin „Sperre aufheben und senden“ klicken. Danach kann er der Person wieder normal schreiben.
- **Bestehende Fehlsperren bereinigen:** Sperren, die durch kurzzeitige Zustellprobleme entstanden sind, werden wieder freigegeben.

## Technische Details
- `isUnsubscribeReply` (src/lib/lead-mailing.ts): Muster auf eindeutige Abmelde-Formulierungen begrenzen, zitierten Text sicherer abschneiden; Tests in src/test/lead-mailing.test.ts ergänzen, inklusive „keine Nachrichten bekommen“ → keine Abmeldung.
- Webhook (src/lib/lead-mailing.server.ts): bei `email.bounced` nur sperren, wenn `data.bounce.type` permanent ist (nicht „Transient“/„Undetermined“); Grund in `lead_mail_error` speichern.
- `sendPortalMail` (src/lib/lead-mailing.functions.ts): Grund aus `lead_mail_status`/`lead_mail_error` in die Fehlermeldung; neuer Parameter `override`, der den Status auf `replied` zurücksetzt und dann sendet. Ein Test prüft: Ein Klick auf „trotzdem senden“ hebt die Sperre auf.
- Postfach-Dialog: Bei Sperrfehler zeigt er einen Bestätigungsknopf.
