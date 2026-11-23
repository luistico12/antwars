#!/usr/bin/env bash
# Richtet den Ant-Wars-Spielserver auf Ubuntu ein. Idempotent, braucht root.
# Aufruf: sudo bash deploy/harden.sh [--dry-run]
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

run() {
  if [ "$DRY" -eq 1 ]; then echo "PLAN: $*"; else echo "+ $*"; "$@"; fi
}
say() { echo "== $*"; }

if [ "$DRY" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit root ausführen: sudo bash deploy/harden.sh"; exit 1
fi
if ! command -v apt-get >/dev/null 2>&1; then
  echo "Dieses Skript erwartet Ubuntu/Debian (apt)."; exit 1
fi
say "System aktualisieren"
run apt-get update
run apt-get install -y ufw fail2ban unattended-upgrades curl ca-certificates gnupg git

say "Node 22 über NodeSource installieren"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  if [ "$DRY" -eq 0 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  else
    echo "PLAN: NodeSource-Repository setup_22.x einbinden"
  fi
  run apt-get install -y nodejs
else
  echo "Node $(node -v) ist bereits vorhanden"
fi

say "Benutzer und Verzeichnis"
if ! id antwars >/dev/null 2>&1; then
  run useradd --system --create-home --home-dir /opt/antwars --shell /usr/sbin/nologin antwars
else
  echo "Benutzer antwars existiert"
fi
run install -d -o antwars -g antwars -m 750 /opt/antwars
run install -d -o antwars -g antwars -m 750 /opt/antwars/server

say "SSH: erst Schlüssel prüfen, dann Passwort-Login aus"
KEYS=""
for f in /root/.ssh/authorized_keys "/home/${SUDO_USER:-nobody}/.ssh/authorized_keys"; do
  [ -s "$f" ] && KEYS="$KEYS $f"
done
if [ -z "$KEYS" ]; then
  echo "FEHLER: Kein authorized_keys gefunden. Passwort-Login bleibt AN."
  echo "Lege zuerst einen SSH-Schlüssel an (ssh-copy-id), dann dieses Skript erneut ausführen."
else
  echo "SSH-Schlüssel gefunden:$KEYS"
  run install -d -m 755 /etc/ssh/sshd_config.d
  if [ "$DRY" -eq 0 ]; then
    printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\nPubkeyAuthentication yes\n' > /etc/ssh/sshd_config.d/99-antwars.conf
  else
    echo "PLAN: /etc/ssh/sshd_config.d/99-antwars.conf schreiben (Passwort-Login aus)"
  fi
  run systemctl reload ssh 2>/dev/null || run systemctl reload sshd
fi

say "Firewall (Heimnetz für SSH)"
read -r -p "Heimnetz für SSH (z. B. 192.168.1.0/24): " HOME_NET || HOME_NET="192.168.1.0/24"
[ -n "$HOME_NET" ] || { echo "Kein Netz angegeben."; exit 1; }
run ufw --force default deny incoming
run ufw --force default allow outgoing
run ufw allow from "$HOME_NET" to any port 22 proto tcp
run ufw allow 80/tcp
run ufw allow 443/tcp
run ufw allow 25565/tcp
run ufw allow 19132/udp
run ufw --force enable
echo "Hinweis: Port 8787 wird NICHT geöffnet – der Cloudflare Tunnel greift lokal zu."

say "fail2ban und automatische Sicherheitsupdates"
run systemctl enable --now fail2ban
run dpkg-reconfigure -f noninteractive unattended-upgrades || true

say "Fertig. Weiter mit deploy/ANLEITUNG-SERVER.md (Tunnel, Dienst, check.sh)."
