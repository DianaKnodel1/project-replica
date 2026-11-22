# Automatisches Backend-Update einrichten (Korrektur)

Die Befehle liefen auf dem **Backend-Server** (Eingabezeile `root@backendserver`). Dadurch darf sich der Backend-Server bei sich selbst anmelden – das bringt nichts. Der Schlüssel muss auf dem **Portal-Server (.124)** erstellt werden.

## Schritte

1. Backend-Server verlassen: `exit` (bis die Eingabezeile `root@host-190-97-167-124` zeigt).
2. Auf dem Portal-Server ausführen:

```bash
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
ssh-copy-id root@190.97.167.123
ssh root@190.97.167.123 "echo SSH-OK"
```

3. Erscheint `SSH-OK` ohne Passwortabfrage, Update testen:

```bash
cd /opt/apps/portal
REPO_URL=https://github.com/DianaKnodel1/project-replica.git bash scripts/deploy.sh
```

Der zusätzliche Schlüssel auf dem Backend-Server schadet nicht und kann bleiben.

Keine Änderungen am Portal-Code nötig.
