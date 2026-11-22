# Automatisches Update: Landing-Server-Schlüssel ergänzen

Das Backend-Update hat jetzt automatisch geklappt ("Backend aktualisiert"). Nur der Landing-Server (190.97.165.54) hat noch nach einem Passwort gefragt.

## Schritte (auf dem Portal-Server .124)

```bash
ssh-copy-id root@190.97.165.54
ssh root@190.97.165.54 "echo SSH-OK"
bash /opt/apps/portal/scripts/sync-landing-server.sh
```

Danach läuft jedes Update komplett automatisch. Keine Code-Änderungen nötig.
