# Passwort-Reset zuverlässig über Resend verschicken

## Empfehlung zur Domain
Kauf keine neue Domain. Nimm eine eigene Unteradresse deiner bestehenden Domain, z. B. `mail.mb-portal.com`, und hinterleg sie in Resend.
- Mitarbeiter kennen den Namen schon. Eine neue Domain wirkt eher wie Spam und hat am Anfang keinen guten Ruf bei Postfächern.
- Eine Unteradresse beeinflusst die bisherigen Mails von `mb-portal.com` nicht.
- Absender wird dann z. B. `MB Portal <passwort@mail.mb-portal.com>`.

Was du in Resend machst: **Domains → Add Domain → `mail.mb-portal.com`**. Danach trägst du die angezeigten DNS-Einträge bei deinem Domain-Anbieter ein und wartest auf „Verified“.

## Was ich in der App ändere
1. Die Passwort-Reset-Mail geht künftig zuerst über Resend. Der bisherige SMTP-Server springt nur ein, wenn Resend fehlschlägt.
2. Der Absender wird fest auf die Resend-Domain gesetzt und hängt nicht mehr vom SMTP der Firma ab. Das ist im Moment die häufigste Ursache, wenn Reset-Mails nicht ankommen.
3. Die Mail behält das bestehende Design und die Signatur.
4. Im Postfach und Mail-Log siehst du, ob die Reset-Mail über Resend oder SMTP verschickt wurde.
5. Auf der Login-Seite steht nach „Passwort vergessen“ immer eine klare Bestätigung. Fehler werden nicht mehr verschluckt.
6. Notlösung für Admins: In der Mitarbeiterliste gibt es den Knopf „Reset-Link kopieren“. Damit kannst du einem Mitarbeiter den Link auch direkt schicken, z. B. per SMS oder WhatsApp.

## Technische Details
- `supabase/functions/send-password-reset/index.ts`: Resend wird zuerst versucht, SMTP danach als Ausweichweg. Der Link wird wie bisher über `auth.admin.generateLink({type:"recovery"})` erzeugt, gerendert über `src/lib/mail-template.ts`-Logik. Bestehende Elemente wie Send-Guard und Claim-Dedupe bleiben erhalten.
- Neue Function-Secrets auf dem eigenen Server: `RESEND_API_KEY` (falls nicht schon gesetzt, auch für Lead-Mailing nutzbar) und `PASSWORD_RESET_FROM` (z. B. `MB Portal <passwort@mail.mb-portal.com>`). Das Deployment läuft über das bestehende `scripts/deploy-edge-function.sh`.
- Admin-Server-Funktion „Reset-Link erzeugen“: nur für die Admin-Rolle, wird geprüft über `requireSupabaseAuth` und die Rolle.
- Hinweis: Edge Functions laufen auf deinem eigenen Server (api.mb-portal.com). Deshalb musst du nach meiner Änderung einmal das Deploy-Skript ausführen.
