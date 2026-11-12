# Landing-Server auf AlmaLinux 9 lauffähig machen

Der gekaufte VPS bleibt bei AlmaLinux. Das Einrichtungs-Programm aus dem Portal wird so erweitert, dass es neben Ubuntu/Debian auch AlmaLinux/Rocky/RHEL 9 automatisch einrichtet. Du führst danach denselben Befehl aus dem Portal noch einmal aus.

## Was sich für dich ändert
- Der Einrichtungs-Befehl erkennt das Betriebssystem selbst und installiert alles Nötige (Webserver mit SSL, Node, Hilfsprogramme).
- Node.js wird jetzt automatisch mit installiert (bisher musste es vorher von Hand drauf sein).
- Die Server-Firewall wird für Webseiten (Port 80/443) geöffnet, SSH bleibt offen.
- Ubuntu-Server funktionieren genau wie bisher.

## Ablauf für dich danach
1. Die Änderung auf dem Portal-Server einspielen (wie gewohnt deploy), damit der Befehl die neue Version ausliefert.
2. Auf dem AlmaLinux-VPS denselben Befehl aus Admin → Infrastruktur erneut ausführen.
3. Am Ende muss "Landing-Server bereit" stehen und der Server im Portal grün werden.
4. Auf dem Portal-Server LANDING_SYNC_HOST auf die neue IP setzen und den Sync starten.

## Technische Details
Datei: src/routes/api/public/landing-server-bootstrap.ts (renderScript)

- OS-Erkennung über /etc/os-release (ID / ID_LIKE): Zweig "apt" (bisheriger Code unverändert) und Zweig "dnf" für rhel/fedora/almalinux/rocky.
- dnf-Zweig, Schritt 1: `dnf install -y epel-release dnf-plugins-core curl ca-certificates unzip jq tar iproute rsync procps-ng`.
- Schritt 2 Caddy: `dnf copr enable -y @caddy/caddy && dnf install -y caddy`; Fallback: offizielles Caddy-Binary nach /usr/bin/caddy plus eigene caddy.service und caddy-User, falls COPR nicht erreichbar.
- Schritt 3 Node: statt Abbruch automatisch installieren, falls /usr/bin/node fehlt oder älter als v18 ist: apt → NodeSource setup_20.x; dnf → `dnf module enable -y nodejs:20 && dnf install -y nodejs`. rsync für den späteren Sync wird in beiden Zweigen mitinstalliert.
- SELinux (nur wenn getenforce = Enforcing): `setsebool -P httpd_can_network_connect 1`, damit Caddy auf 127.0.0.1:3001 weiterleiten darf.
- firewalld (falls aktiv): `firewall-cmd --permanent --add-service=http --add-service=https --add-service=ssh && firewall-cmd --reload`.
- nologin-Pfad: /usr/sbin/nologin bzw. /sbin/nologin je nach Vorhandensein.
- CLEAN-Block und SSH-Wiederherstellung am Ende: zusätzlich dnf-Variante (nginx/httpd entfernen, openssh-server/sshd), kein autoremove.
- DEBIAN_FRONTEND und sources.list-Reparatur nur im apt-Zweig.
- Unbekanntes OS: klare Meldung "Nur Ubuntu/Debian oder AlmaLinux/Rocky 9 unterstützt" statt "apt-get: command not found".
- scripts/harden-landing-server.sh: dnf-Zweig nutzt firewalld statt ufw und dnf-automatic statt unattended-upgrades (ufw/unattended-upgrades gibt es auf AlmaLinux nicht).
- Ein kleiner Test prüft, dass das erzeugte Skript beide Zweige (apt-get und dnf) sowie die Node-Installation enthält.
- AGENTS.md: Regel ergänzen, dass das Bootstrap-Skript Debian- und RHEL-Familie unterstützen muss.
