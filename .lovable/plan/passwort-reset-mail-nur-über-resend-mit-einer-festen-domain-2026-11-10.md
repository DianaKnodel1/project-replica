# Passwort-Reset-Mail nur über Resend mit einer festen Domain

## Domain
Eine einzige feste Absender-Domain für alle Passwort-vergessen-Mails, z. B. `mail.mb-portal.com` (Unteradresse deiner bestehenden Domain – kein Neukauf nötig; eine neue Domain geht aber genauso).
In Resend: **Domains → Add Domain** → DNS-Einträge beim Domain-Anbieter eintragen → warten bis „Verified“.

## Was ich ändere
1. Die Passwort-vergessen-Mail geht ausschließlich über Resend – kein SMTP mehr, keine Firmen-Einstellungen nötig.
2. Fester Absender, z. B. `MB Portal <passwort@mail.mb-portal.com>`, für alle Mitarbeiter gleich.
3. Bestehendes Mail-Design bleibt.
4. „Passwort vergessen“ zeigt immer eine klare Bestätigung; Versandfehler werden protokolliert und im Admin sichtbar.
5. Notlösung: Admin-Knopf „Reset-Link kopieren“ in der Mitarbeiterliste, um den Link direkt (SMS/WhatsApp) zu schicken.

## Technische Details
- `supabase/functions/send-password-reset/index.ts`: SMTP-Transport und Tenant-SMTP-Auflösung entfernen; Versand per `POST https://api.resend.com/emails` mit `RESEND_API_KEY`, Absender aus `PASSWORD_RESET_FROM`. Link weiter über `auth.admin.generateLink({type:"recovery"})`; Send-Guard und Claim-Dedupe bleiben.
- Secrets auf dem eigenen Server (api.mb-portal.com): `RESEND_API_KEY`, `PASSWORD_RESET_FROM`. Danach einmal `scripts/deploy-edge-function.sh send-password-reset` ausführen.
- Admin-Server-Funktion „Reset-Link erzeugen“: nur mit Admin-Rolle (`requireSupabaseAuth` + Rollenprüfung).
