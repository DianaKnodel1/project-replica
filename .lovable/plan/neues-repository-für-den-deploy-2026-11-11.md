# Neues Repository für den Deploy

Neues Repo: `https://github.com/DianaKnodel1/project-replica.git`

## Änderungen
- `scripts/deploy.sh` und `scripts/setup-server2.sh`: Standard-Repo von `upload-helper` auf `project-replica` umstellen (alte Namen im Kommentar ergänzen). Das Deploy-Skript stellt die Git-Quelle auf dem Server dann automatisch um.
- Anleitungen (`docs/SERVER-SETUP.md`, `docs/SERVER-UMZUG.md`, `docs/DISASTER-RECOVERY.md`, `docs/SERVER-HARDENING.md`): alle alten Repo-Links auf den neuen ersetzen.

## Befehle für dich auf dem Portal-Server (sofort nutzbar)
```text
cd /opt/apps/portal
git remote set-url origin https://github.com/DianaKnodel1/project-replica.git
git fetch origin main
git reset --hard origin/main
REPO_URL=https://github.com/DianaKnodel1/project-replica.git bash scripts/deploy.sh
```
Danach den Landing-Server wie gewohnt mit `bash scripts/sync-landing-server.sh` aktualisieren.
