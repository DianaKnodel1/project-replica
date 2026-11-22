# Personalleiter-Konto: nur zugewiesene Personen sehen

## Idee statt Farben
Die rote/grüne Markierung fällt weg. Stattdessen gibt es bei jeder Person einen Knopf **„Zuweisen an …“**. Dort wählst du den Personalleiter (oder später weitere Caller). Neben dem Namen erscheint dann ein kleines Schild mit seinem Namen, z. B. „Caller: Herr Meier“.

Warum keine Farbe:
- Man sieht sofort, **wem** die Person gehört, nicht nur „grün“.
- Es funktioniert auch mit mehreren Callern, ohne dass die Farben ausgehen.
- Die Zuweisung bleibt beim Wechsel vom Bewerber zum Mitarbeiter erhalten, so wie die Markierung bisher.

## Was der Personalleiter sieht
- Er meldet sich mit eigenem Konto an und sieht nur **Chat** und **Postfach**.
- **Chat:** nur die Personen, die du ihm zugewiesen hast. Er kann dort lesen und antworten.
- **Postfach:** nur die Mails dieser Personen. Er kann antworten, aber keine neuen Mails an fremde Adressen schicken.
- Bewerberliste, Mitarbeiterliste, Einstellungen, Landing Pages usw. sieht er nicht.

## Was du siehst
- In Bewerberliste, Mitarbeiterliste und Chat gibt es den Knopf „Zuweisen an …“ und einen Filter „Nur zugewiesene von …“.
- Unter **Admin → Konten** legst du das Konto an, als neue Art „Caller / Personalleiter“.

## Was wegfällt
- Die grün/blaue Kontakt-Markierung mit ihrem Auswahlknopf und Filter in Bewerber-, Mitarbeiter- und Chat-Liste. Die gespeicherten Markierungen bleiben in der Datenbank, werden aber nicht mehr angezeigt.

## Technische Details
- Neue Rolle `caller` in `app_role`, Zuweisung `applications.assigned_caller_id` (uuid → auth.users). Personen werden über `profiles.application_id` / `applications.user_id` aufgelöst, wie bisher beim Marker. Hilfsfunktion `is_assigned_caller(uid, application_id)` (security definer).
- RLS: Caller sehen nur `chat_conversations`/`chat_messages` und `lead_messages` zu zugewiesenen Personen. Postfach-Serverfunktionen (`listMailThreads`, `getMailThread`, `sendPortalMail`, `setThreadHandled`) erlauben `caller` und filtern serverseitig auf zugewiesene Personen bzw. deren Adressen. Senden ist nur an diese Adressen erlaubt.
- Konto-Anlage über die bestehenden `staff-accounts`-Funktionen, erweitert um Rollenwahl. Login leitet Caller direkt in den Chat. Die Seitenleiste zeigt für Caller nur Chat und Postfach.
- `ContactMarkerPicker` und `use-contact-markers` werden aus den Listen entfernt, die Spalte `contact_marker` bleibt bestehen. Die AGENTS.md-Regel wird ersetzt.
- Tests: Caller sieht nur zugewiesene Threads; Senden an eine nicht zugewiesene Adresse wird abgelehnt.
