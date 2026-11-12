// Erzeugt das Bootstrap-Shellskript für Landing-Server (Ubuntu/Debian via apt,
// AlmaLinux/Rocky/RHEL via dnf).

function shellEscape(s: string): string {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

export function renderScript(p: {
  serverName: string;
  serverId: string;
  token: string;
  supabaseUrl: string;
  supabaseKey: string;
  portalOrigin: string;
  acmeEmail: string;
  clean: boolean;
}): string {
  const SERVER_FILES = `${p.portalOrigin}/api/public/landing-server-files`;
  const cleanBlock = p.clean
    ? `
echo "[bootstrap] 0/7 CLEAN: vorhandene Installation entfernen …"
systemctl stop landing-server.service 2>/dev/null || true
systemctl stop landing-heartbeat.service 2>/dev/null || true
systemctl stop landing.service 2>/dev/null || true
systemctl stop caddy 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
systemctl stop httpd 2>/dev/null || true
systemctl disable landing-server.service 2>/dev/null || true
systemctl disable landing-heartbeat.service 2>/dev/null || true
systemctl disable landing.service 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true
systemctl disable httpd 2>/dev/null || true
rm -f /etc/systemd/system/landing-server.service
rm -f /etc/systemd/system/landing-heartbeat.service
rm -f /etc/systemd/system/landing.service
rm -rf /etc/systemd/system/landing-server.service.d
rm -rf /etc/systemd/system/caddy.service.d
systemctl daemon-reload
# Verzeichnisse / alte Renderer plattmachen
rm -rf /opt/landing-server /opt/apps/landing-server
rm -rf /etc/caddy/Caddyfile.d /etc/caddy/conf.d
rm -f  /etc/caddy/Caddyfile
# Ports 80/443/3001 erzwungen freiräumen (laufende Prozesse killen)
for P in 80 443 3001; do
  PIDS=\$(ss -lptnH "sport = :\$P" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  for PID in \$PIDS; do kill -9 "\$PID" 2>/dev/null || true; done
done
# Optional vorhandene Pakete entfernen (apache/nginx) — Caddy bleibt, wird gleich neu konfiguriert
if command -v apt-get >/dev/null; then
  # Sicherstellen, dass SSH als manuell installiert gilt, damit es autoremove nicht anfasst
  apt-mark manual openssh-server openssh-sftp-server ssh task-ssh-server 2>/dev/null || true
  apt-get remove -y -qq nginx nginx-common nginx-full apache2 apache2-bin apache2-utils 2>/dev/null || true
  # Kein apt-get autoremove! Das hat auf dem letzten Server openssh-server entfernt.
elif command -v dnf >/dev/null; then
  dnf remove -y -q nginx httpd 2>/dev/null || true
fi
# Alten landing-User entfernen (wird gleich neu angelegt)
id -u landing >/dev/null 2>&1 && userdel -r landing 2>/dev/null || true
echo "[bootstrap]   ✓ Server geputzt"
`
    : "";
  return `#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Landing-Server Bootstrap — generiert von ${p.portalOrigin}
# Server: ${p.serverName}  (id=${p.serverId})
# Idempotent: kann mehrfach ausgeführt werden.${p.clean ? "\n# CLEAN-Modus: bestehende Webserver/Services werden vorher entfernt." : ""}
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail
trap 'echo "[bootstrap] ❌ Fehler in Zeile $LINENO" >&2' ERR

if [ "$EUID" -ne 0 ]; then echo "Bitte mit sudo/root ausführen."; exit 1; fi

INSTALL_DIR=/opt/landing-server
SERVICE_USER=landing
HEARTBEAT_URL=${shellEscape(`${p.portalOrigin}/api/public/landing-server-heartbeat`)}
BOOTSTRAP_TOKEN=${shellEscape(p.token)}
SUPABASE_URL=${shellEscape(p.supabaseUrl)}
SUPABASE_PUBLISHABLE_KEY=${shellEscape(p.supabaseKey)}
ACME_EMAIL=${shellEscape(p.acmeEmail)}
SERVER_FILES_BASE=${shellEscape(SERVER_FILES)}
${cleanBlock}

# Betriebssystem erkennen: Debian/Ubuntu (apt) oder AlmaLinux/Rocky/RHEL (dnf)
OS_ID=$(. /etc/os-release 2>/dev/null; echo "\${ID:-} \${ID_LIKE:-}")
if command -v apt-get >/dev/null 2>&1; then
  PKG=apt
elif command -v dnf >/dev/null 2>&1; then
  PKG=dnf
else
  echo "[bootstrap] ❌ Nicht unterstütztes Betriebssystem ($OS_ID)." >&2
  echo "[bootstrap]    Unterstützt: Ubuntu/Debian oder AlmaLinux/Rocky/RHEL 9." >&2
  exit 1
fi
echo "[bootstrap] Betriebssystem: $OS_ID (Paketverwaltung: $PKG)"

echo "[bootstrap] 1/7 Pakete aktualisieren …"
if [ "$PKG" = apt ]; then
  export DEBIAN_FRONTEND=noninteractive
  # Debian 11/12: falls security-Repo des Anbieters falsch gesetzt ist, sources.list reparieren
  if grep -q "bullseye" /etc/os-release 2>/dev/null; then
    cat > /etc/apt/sources.list <<'SRC'
deb http://deb.debian.org/debian bullseye main contrib non-free
deb http://security.debian.org/debian-security bullseye-security main contrib non-free
deb http://deb.debian.org/debian bullseye-updates main contrib non-free
SRC
  elif grep -q "bookworm" /etc/os-release 2>/dev/null; then
    cat > /etc/apt/sources.list <<'SRC'
deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware
deb http://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
deb http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware
SRC
  fi
  apt-get update -o Acquire::AllowReleaseInfoChange=true -qq || apt-get update -qq || true
  apt-get install -y -qq curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https unzip jq gnupg rsync iproute2 >/dev/null
else
  dnf install -y -q epel-release >/dev/null 2>&1 || true
  dnf install -y -q dnf-plugins-core curl ca-certificates unzip jq tar iproute rsync procps-ng policycoreutils-python-utils >/dev/null
fi

echo "[bootstrap] 2/7 Caddy installieren …"
if ! command -v caddy >/dev/null 2>&1; then
  if [ "$PKG" = apt ]; then
    curl -sSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -sSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  else
    if ! { dnf copr enable -y -q @caddy/caddy >/dev/null 2>&1 && dnf install -y -q caddy >/dev/null 2>&1; }; then
      echo "[bootstrap]   COPR nicht erreichbar — lade offizielles Caddy-Programm …"
      ARCH=$(uname -m); case "$ARCH" in x86_64) CARCH=amd64;; aarch64) CARCH=arm64;; *) CARCH=amd64;; esac
      curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=$CARCH" -o /usr/bin/caddy
      chmod +x /usr/bin/caddy
      id -u caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --create-home --shell /sbin/nologin caddy
      mkdir -p /etc/caddy
      cat > /etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
UNIT
      systemctl daemon-reload
    fi
  fi
fi
systemctl enable caddy >/dev/null 2>&1 || true
systemctl stop nginx apache2 httpd 2>/dev/null || true
systemctl disable nginx apache2 httpd 2>/dev/null || true
for P in 80 443; do
  PIDS=$(ss -lptnH "sport = :$P" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  for PID in $PIDS; do
    COMM=$(ps -p "$PID" -o comm= 2>/dev/null || true)
    if [ "$COMM" != "caddy" ]; then kill -9 "$PID" 2>/dev/null || true; fi
  done
done

# SELinux (AlmaLinux/RHEL): Caddy darf an den lokalen Renderer weiterleiten
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  setsebool -P httpd_can_network_connect 1 2>/dev/null || true
fi
# firewalld (AlmaLinux/RHEL): Webseiten + SSH erlauben
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active firewalld >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=ssh --add-service=http --add-service=https >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

echo "[bootstrap] 3/7 Node prüfen …"
NODE_MAJOR=0
if [ -x /usr/bin/node ]; then
  NODE_MAJOR=$(/usr/bin/node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
fi
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[bootstrap]   Node.js 20 wird installiert …"
  if [ "$PKG" = apt ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  else
    dnf module reset -y -q nodejs >/dev/null 2>&1 || true
    dnf module enable -y -q nodejs:20 >/dev/null 2>&1 || true
    dnf install -y -q nodejs >/dev/null
  fi
fi
command -v /usr/bin/node >/dev/null 2>&1 || { echo "[bootstrap] ❌ Node.js konnte nicht installiert werden." >&2; exit 1; }
echo "[bootstrap]   Node $(/usr/bin/node -v)"

echo "[bootstrap] 4/7 User + Verzeichnisse …"
NOLOGIN=/usr/sbin/nologin; [ -x "$NOLOGIN" ] || NOLOGIN=/sbin/nologin
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$INSTALL_DIR" --shell "$NOLOGIN" "$SERVICE_USER"
mkdir -p "$INSTALL_DIR/themes"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

echo "[bootstrap] 5/7 Renderer + Themes laden …"
curl -fsSL "$SERVER_FILES_BASE/server.js"  -o "$INSTALL_DIR/server.js"
curl -fsSL "$SERVER_FILES_BASE/legal-content.js"  -o "$INSTALL_DIR/legal-content.js"
curl -fsSL "$SERVER_FILES_BASE/package.json"  -o "$INSTALL_DIR/package.json"
curl -fsSL "$SERVER_FILES_BASE/heartbeat.sh" -o "$INSTALL_DIR/heartbeat.sh"
if head -c 32 "$INSTALL_DIR/server.js" | grep -qiE '<!DOCTYPE html|<html'; then
  echo "[bootstrap] ❌ server.js Download enthält HTML statt JavaScript." >&2
  echo "[bootstrap]    Prüfe URL: $SERVER_FILES_BASE/server.js" >&2
  exit 1
fi
if grep -q 'Bun\.serve' "$INSTALL_DIR/server.js"; then
  echo "[bootstrap] ❌ server.js ist noch die alte Bun-Version." >&2
  exit 1
fi
if ! grep -q "createServer" "$INSTALL_DIR/server.js" && ! grep -q "node:http" "$INSTALL_DIR/server.js"; then
  echo "[bootstrap] ❌ server.js sieht nicht wie der Node-Renderer aus." >&2
  exit 1
fi
if [ ! -s "$INSTALL_DIR/legal-content.js" ] || ! grep -q 'renderImpressum' "$INSTALL_DIR/legal-content.js"; then
  echo "[bootstrap] ❌ legal-content.js fehlt oder ist ungültig." >&2
  exit 1
fi
chmod +x "$INSTALL_DIR/heartbeat.sh"

# Themes-Liste & Dateien holen
mkdir -p "$INSTALL_DIR/themes"
THEMES_JSON=$(curl -fsSL "$SERVER_FILES_BASE/themes.json")
echo "$THEMES_JSON" | jq -r '.themes[]' | while read -r THEME_ID; do
  mkdir -p "$INSTALL_DIR/themes/$THEME_ID"
  for F in template.html style.css script.js; do
    curl -fsSL "$SERVER_FILES_BASE/themes/$THEME_ID/$F" -o "$INSTALL_DIR/themes/$THEME_ID/$F"
  done
done

# .env schreiben
cat > "$INSTALL_DIR/.env" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
PORT=3001
SERVER_ID=${p.serverId}
BOOTSTRAP_TOKEN=$BOOTSTRAP_TOKEN
HEARTBEAT_URL=$HEARTBEAT_URL
SERVER_FILES_BASE=$SERVER_FILES_BASE
PORTAL_API_ENDPOINT=${shellEscape(`${p.portalOrigin}/api/public/applications`)}
ACME_EMAIL=$ACME_EMAIL
EOF
chmod 600 "$INSTALL_DIR/.env"
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"

# Caddyfile
cat > /etc/caddy/Caddyfile <<EOF
{
  email $ACME_EMAIL
  on_demand_tls {
    ask http://127.0.0.1:3001/_internal/ask
  }
}

:80 {
  redir https://{host}{uri} 308
}

:443 {
  tls {
    on_demand
  }
  encode zstd gzip
  reverse_proxy 127.0.0.1:3001 {
    header_up Host {host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }
}
EOF

echo "[bootstrap] 6/7 systemd-Services …"
rm -rf /etc/systemd/system/landing-server.service.d
cat > /etc/systemd/system/landing-server.service <<EOF
[Unit]
Description=Landing Renderer (Node)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node --max-old-space-size=128 server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/landing-heartbeat.service <<EOF
[Unit]
Description=Landing-Server Heartbeat
After=network.target

[Service]
Type=simple
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/bin/bash $INSTALL_DIR/heartbeat.sh
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now landing-server.service
systemctl enable --now landing-heartbeat.service
caddy validate --config /etc/caddy/Caddyfile || { journalctl -u caddy -n 80 --no-pager || true; exit 1; }
if ! systemctl reload caddy; then
  systemctl restart caddy || { systemctl status caddy --no-pager || true; journalctl -u caddy -n 80 --no-pager || true; exit 1; }
fi

echo "[bootstrap] 7/7 Initialer Heartbeat …"
sleep 2
RENDERER_HEALTHY=false
if curl -fsS http://127.0.0.1:3001/_health >/dev/null 2>&1; then
  RENDERER_HEALTHY=true
fi
curl -sS -X POST "$HEARTBEAT_URL" \
  -H 'Content-Type: application/json' \
  -d "{\\"token\\":\\"$BOOTSTRAP_TOKEN\\",\\"agent_version\\":\\"1.2.0\\",\\"renderer_healthy\\":$RENDERER_HEALTHY}" || true

# Sicherstellen, dass SSH weiterhin erreichbar ist (hat autoremove zuvor entfernt)
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active ssh >/dev/null 2>&1 && ! systemctl is-active sshd >/dev/null 2>&1; then
    echo "[bootstrap] SSH-Dienst nicht aktiv — wird neu installiert/gestartet ..."
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -qq
      apt-get install -y -qq openssh-server 2>/dev/null || true
    else
      dnf install -y -q openssh-server 2>/dev/null || true
    fi
    systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd 2>/dev/null || true
  fi
fi

echo ""
echo "✅ Landing-Server bereit."
echo "   - Renderer:  systemctl status landing-server"
echo "   - Heartbeat: systemctl status landing-heartbeat"
echo "   - Logs:      journalctl -u landing-server -f"
echo "   - SSH:       systemctl status ssh || systemctl status sshd"
`;
}
