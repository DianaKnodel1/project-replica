# Anmeldung nach Server-Neustart wieder zum Laufen bringen

## Was ich geprüft habe
- Der Backend-Server `api.mb-portal.com` ist erreichbar.
- Eine Test-Anmeldung mit dem Testkonto bricht aber mit **504 (Zeitüberschreitung)** ab. Der Anmelde-Dienst auf dem Backend-Server antwortet also nicht.
- Wahrscheinliche Ursache: Nach dem Verlängern bzw. Neustart sind nicht alle Dienste wieder gestartet. Meist hängen die Datenbank oder der Anmelde-Dienst.

## Schritte (auf dem Backend-Server, als root)
1. Anmelden: `ssh root@<IP-vom-Backend-Server>`
2. Laufende Dienste ansehen:
   ```bash
   docker ps -a --format "table {{.Names}}\t{{.Status}}"
   ```
   Achte auf `db`, `auth`, `kong`, `rest`. Alles sollte „Up“ bzw. „healthy“ sein.
3. Alle Dienste neu starten (im Ordner der Backend-Installation, meist `/opt/supabase/docker` oder ähnlich):
   ```bash
   cd "$(dirname "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' $(docker ps -aq | head -1))")"
   docker compose up -d
   ```
4. Eine Minute warten, dann prüfen:
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   docker logs --tail 50 $(docker ps -a --format '{{.Names}}' | grep -i auth | head -1)
   ```
5. Ist die Festplatte voll (`df -h`, über 95 %), startet die Datenbank nicht. Dann zuerst Platz schaffen: `docker system prune -f`.
6. Danach erneut im Portal einloggen. Ich prüfe die Anmeldung von hier aus noch einmal mit dem Testkonto.

## Wenn es dann noch nicht geht
Schick mir die Ausgabe von Schritt 2 und 4 (Text oder Screenshot). Daran sehe ich, welcher Dienst hängt.
