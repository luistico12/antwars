#!/usr/bin/env bash
# Antwars: Rechner absichern und Dienst-Benutzer anlegen (Ubuntu).
#
#   sudo ./harden.sh --dry-run    zeigt alles, ändert nichts (auch ohne root lauffähig)
#   sudo ./harden.sh              fragt nach, zeigt den Plan, ändert erst nach Eingabe von  JA-AENDERN
#
# Es gibt absichtlich KEINEN Modus "--yes": Firewall und SSH sind zu riskant für Automatik.
# Das Skript ist idempotent: ein zweiter Lauf mit denselben Antworten ändert nichts.
# Jede geänderte Datei wird vorher nach /root/antwars-backup-<Datum>/ gesichert.
set -Eeuo pipefail

DRY=0
usage() {
  cat <<'USAGE'
Aufruf: harden.sh [--dry-run]
  --dry-run   nur anzeigen, was passieren würde; nichts ändern
  -h, --help  diese Hilfe
USAGE
}
if [[ $# -gt 1 ]]; then usage >&2; exit 2; fi
case "${1:-}" in
  "") ;;
  --dry-run) DRY=1 ;;
  -h|--help) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

# ---------------------------------------------------------------- Ausgabe
say()  { printf '%s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  ACHTUNG: %s\n' "$*" >&2; }
die()  { printf 'ABBRUCH: %s\n' "$*" >&2; exit 1; }
hr()   { printf '\n== %s ==\n' "$*"; }
trap 'printf "\nFEHLER in Zeile %s. Das Skript bricht ab. Ein erneuter Lauf ist gefahrlos, bereits Erledigtes wird übersprungen.\n" "$LINENO" >&2' ERR

CHANGES=0
changed() { CHANGES=$((CHANGES + 1)); info "GEÄNDERT: $*"; }
have() { command -v "$1" >/dev/null 2>&1; }

INTERACTIVE=0
[[ -t 0 ]] && INTERACTIVE=1

if (( DRY )); then
  say "TROCKENLAUF: Es wird nichts geändert. Zeilen mit  \$  zeigen Befehle, die ein echter Lauf ausführen würde."
fi
if [[ $EUID -ne 0 ]]; then
  (( DRY )) || die "Bitte mit root starten:  sudo ./harden.sh"
  warn "Du bist nicht root. Im Trockenlauf geht das, aber Anzeigen (z. B. Prozessnamen zu Ports) sind dann unvollständig."
fi
if (( ! DRY && ! INTERACTIVE )); then
  die "Ein echter Lauf braucht ein Terminal (Rückfragen). Start ihn direkt in einer SSH-Sitzung, nicht per Skript oder Cron."
fi

# ---------------------------------------------------------------- Hilfsfunktionen
BACKUP_DIR="/root/antwars-backup-$(date +%F)"
backup() { # $1 = Datei oder Verzeichnis; sichert beim ersten Mal des Tages das Original
  local f=$1 t
  [[ -e $f ]] || return 0
  (( DRY )) && return 0
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  t="$BACKUP_DIR$f"
  [[ -e $t ]] && return 0
  mkdir -p "$(dirname "$t")"
  cp -a "$f" "$t"
  info "Sicherung: $t"
}
note_new() { # merkt sich neu angelegte Dateien für den Rückbau
  (( DRY )) && return 0
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  printf '%s\n' "$1" >>"$BACKUP_DIR/NEU-ERSTELLT.txt"
}

run() { # zeigt den Befehl, führt ihn nur im echten Lauf aus
  printf '    $ %s\n' "$*"
  if (( ! DRY )); then "$@"; fi
}

LAST_CHANGED=0
put_file() { # $1 Ziel  $2 Modus  $3 Besitzer:Gruppe ; Inhalt kommt von stdin
  local dest=$1 mode=$2 owner=$3 tmp
  tmp=$(mktemp)
  cat >"$tmp"
  LAST_CHANGED=0
  if [[ -f $dest ]] && cmp -s "$tmp" "$dest" && [[ $(stat -c '%a %U:%G' "$dest") == "$mode $owner" ]]; then
    info "schon in Ordnung: $dest"
    rm -f "$tmp"; return 0
  fi
  LAST_CHANGED=1
  if (( DRY )); then
    info "würde schreiben: $dest (Modus $mode, Besitzer $owner). Inhalt:"
    sed 's/^/        | /' "$tmp"
    rm -f "$tmp"; return 0
  fi
  if [[ -e $dest ]]; then backup "$dest"; else note_new "$dest"; fi
  install -D -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$dest"
  rm -f "$tmp"
  changed "geschrieben: $dest"
}

ensure_dir() { # $1 Pfad  $2 Modus  $3 Besitzer:Gruppe
  local d=$1 mode=$2 owner=$3
  if [[ -d $d ]] && [[ $(stat -c '%a %U:%G' "$d") == "$mode $owner" ]]; then
    info "schon in Ordnung: $d"; return 0
  fi
  if [[ ! -d $d ]]; then (( DRY )) || note_new "$d"; fi
  run install -d -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$d"
  (( DRY )) || changed "Verzeichnis: $d"
}

ask() { # ask "Frage" "Vorgabe" -> Antwort in $ANSWER
  local q=$1 def=${2:-} a
  if (( ! INTERACTIVE )); then
    ANSWER=$def
    info "(kein Terminal, Trockenlauf) $q -> Vorgabe: ${def:-leer}"
    return 0
  fi
  read -r -p "  $q [${def}] " a || a=""
  ANSWER=${a:-$def}
}

valid_ports() { # Liste von Zahlen 1..65535, leer ist erlaubt
  local p
  for p in $1; do
    [[ $p =~ ^[0-9]+$ ]] && (( 10#$p >= 1 && 10#$p <= 65535 )) || return 1
  done
  return 0
}
norm_ports() { # sortiert, ohne Doppelte, in einer Zeile
  local p
  for p in $1; do printf '%d\n' "$((10#$p))"; done | sort -un | tr '\n' ' ' | sed 's/ $//'
}
valid_cidr() {
  local c=$1 ip bits o
  [[ $c =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]] || return 1
  ip=${c%/*}; bits=${c#*/}
  (( 10#$bits <= 32 )) || return 1
  local IFS=.
  for o in $ip; do (( 10#$o <= 255 )) || return 1; done
  return 0
}
ip2int() { local IFS=.; local a b c d; read -r a b c d <<<"$1"; echo $(( (10#$a << 24) + (10#$b << 16) + (10#$c << 8) + 10#$d )); }
ip_in_cidr() {
  local ip=$1 net=${2%/*} bits=${2#*/} mask
  [[ $ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  bits=$((10#$bits))
  mask=$(( bits == 0 ? 0 : (0xFFFFFFFF << (32 - bits)) & 0xFFFFFFFF ))
  (( ($(ip2int "$ip") & mask) == ($(ip2int "$net") & mask) ))
}

public_ports() { # $1 = tcp|udp ; lauschende Ports, die nicht nur auf Loopback hören
  have ss || return 0
  local flag=-ltn
  [[ $1 == udp ]] && flag=-lun
  ss -H "$flag" 2>/dev/null | awk '{a=$4; if (a ~ /^127\./ || a ~ /^\[::1\]:/) next; n=split(a,p,":"); print p[n]}' | sort -un | tr '\n' ' ' | sed 's/ $//' || true
}
detect_lan() {
  have ip || return 0
  ip -4 -o route show scope link 2>/dev/null \
    | awk '$1 ~ /\// && $1 ~ /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/ {print $1; exit}' || true
}
detect_ssh_port() {
  local p=""
  if have ss; then
    p=$(ss -H -ltnp 2>/dev/null | awk '/"sshd"/ {n=split($4,a,":"); print a[n]; exit}' || true)
  fi
  echo "${p:-22}"
}
pkg_installed() { dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q '^install ok installed$'; }

# ---------------------------------------------------------------- 0. Vorprüfung
hr "0. Vorprüfung"
OS_ID=""; OS_VER=""
if [[ -r /etc/os-release ]]; then
  OS_ID=$(. /etc/os-release; echo "${ID:-}")
  OS_VER=$(. /etc/os-release; echo "${VERSION_ID:-}")
fi
info "System: ${OS_ID:-unbekannt} ${OS_VER:-}"
if [[ $OS_ID != ubuntu ]]; then
  warn "Dieses Skript ist für Ubuntu geschrieben (hier: ${OS_ID:-unbekannt})."
  if (( ! DRY )); then
    ask "Trotzdem weitermachen? Tippe  ja  zum Fortfahren" "nein"
    [[ $ANSWER == ja ]] || die "Abgebrochen."
  fi
fi
if ! have ss; then warn "Das Programm 'ss' fehlt (Paket iproute2). Die Anzeige der offenen Ports ist leer."; fi

if (( ! DRY )); then
  have flock || die "flock fehlt (Paket util-linux)."
  mkdir -p /run/lock
  exec 9>/run/lock/antwars-harden.lock
  flock -n 9 || die "harden.sh läuft schon (Sperrdatei /run/lock/antwars-harden.lock)."
fi

CONF=/etc/antwars/harden.conf
conf_get() { [[ -r $CONF ]] && sed -n "s/^$1=//p" "$CONF" | head -n1 | tr -d '"' || true; }

# ---------------------------------------------------------------- 1. Bestandsaufnahme
hr "1. Was lauscht gerade auf diesem Rechner?"
if have ss; then
  say "  TCP (lauschend):"
  ss -ltnp 2>/dev/null | sed 's/^/    /' || true
  say "  UDP (lauschend):"
  ss -lunp 2>/dev/null | sed 's/^/    /' || true
fi
PUB_TCP=$(public_ports tcp)
PUB_UDP=$(public_ports udp)
info "Von außen erreichbare TCP-Ports (nicht nur Loopback): ${PUB_TCP:-keine erkannt}"
info "Von außen erreichbare UDP-Ports (nicht nur Loopback): ${PUB_UDP:-keine erkannt}"
if have docker; then
  warn "Docker ist installiert. Von Docker veröffentlichte Ports umgehen ufw (bekannte Eigenheit von Docker). Prüfe sie mit  docker ps  selbst."
fi

# ---------------------------------------------------------------- 2. Fragen
hr "2. Fragen (Enter übernimmt die Vorgabe in eckigen Klammern)"
say "Wichtig: ufw wird auf 'eingehend alles verbieten' gestellt. NUR die Ports, die du hier nennst, bleiben von außen erreichbar."
say "Auf diesem Rechner läuft auch Minecraft. Nenne unbedingt dessen Port, sonst können deine Freunde nicht mehr beitreten."

# Admin-Benutzer
DEF_ADMIN=${SUDO_USER:-$(conf_get ADMIN_USER)}
[[ ${DEF_ADMIN:-} == root ]] && DEF_ADMIN=""
ask "Admin-Benutzer, der sich per SSH anmeldet (nicht root)" "${DEF_ADMIN:-}"
ADMIN_USER=$ANSWER
if [[ -n $ADMIN_USER ]] && ! id -u "$ADMIN_USER" >/dev/null 2>&1; then
  die "Benutzer '$ADMIN_USER' existiert nicht."
fi

# SSH
# Vorgabe: Port der echten SSH-Sitzung (4. Feld von SSH_CONNECTION), sonst die Einstellung von sshd, sonst gespeichert/geraten.
SESSION_SSH_PORT=""
if [[ -n ${SSH_CONNECTION:-} ]]; then read -r _ _ _ SESSION_SSH_PORT _ <<<"$SSH_CONNECTION" || true; fi
[[ ${SESSION_SSH_PORT:-} =~ ^[0-9]+$ ]] || SESSION_SSH_PORT=""
SSHD_PORT=""
_sshd=$(command -v sshd || true); [[ -z $_sshd && -x /usr/sbin/sshd ]] && _sshd=/usr/sbin/sshd
if [[ -n $_sshd ]]; then SSHD_PORT=$("$_sshd" -T 2>/dev/null | awk '$1=="port"{print $2; exit}' || true); fi
[[ ${SSHD_PORT:-} =~ ^[0-9]+$ ]] || SSHD_PORT=""
SSH_PORT_DEF=${SESSION_SSH_PORT:-${SSHD_PORT:-$(conf_get SSH_PORT)}}
SSH_PORT_DEF=${SSH_PORT_DEF:-$(detect_ssh_port)}
while :; do
  ask "SSH-Port dieses Rechners" "$SSH_PORT_DEF"
  if valid_ports "$ANSWER" && [[ -n $ANSWER && $ANSWER != *" "* ]]; then
    SSH_PORT=$((10#$ANSWER))
    for _k in "$SESSION_SSH_PORT" "$SSHD_PORT"; do
      if [[ -n $_k && $_k != "$SSH_PORT" ]]; then warn "Du gibst $SSH_PORT an, die laufende SSH-Sitzung bzw. sshd nutzt aber Port $_k. Neue Anmeldungen auf $_k wären gesperrt."; fi
    done
    break
  fi
  warn "Bitte genau eine Portnummer."
  (( INTERACTIVE )) || { SSH_PORT=22; break; }
done

LAN_DEF=$(conf_get SSH_SOURCE); [[ $LAN_DEF == any ]] && LAN_DEF=""
LAN_DEF=${LAN_DEF:-$(detect_lan)}
CLIENT_IP=""
[[ -n ${SSH_CONNECTION:-} ]] && CLIENT_IP=${SSH_CONNECTION%% *}
[[ -z $CLIENT_IP && -n ${SSH_CLIENT:-} ]] && CLIENT_IP=${SSH_CLIENT%% *}
[[ -n $CLIENT_IP ]] && info "Deine aktuelle SSH-Sitzung kommt von: $CLIENT_IP"
while :; do
  say "  SSH nur aus dem Heimnetz erlauben (empfohlen). Gib das Netz als CIDR an, z. B. 192.168.1.0/24."
  say "  Nur wenn du SSH aus dem ganzen Internet erlauben willst, tippe genau:  ALLE"
  ask "Heimnetz (CIDR) oder ALLE" "${LAN_DEF:-192.168.1.0/24}"
  if [[ $ANSWER == ALLE ]]; then SSH_SOURCE=any; break; fi
  if valid_cidr "$ANSWER"; then
    SSH_SOURCE=$ANSWER
    if [[ -n $CLIENT_IP ]] && ! ip_in_cidr "$CLIENT_IP" "$SSH_SOURCE"; then
      warn "Deine aktuelle Verbindung ($CLIENT_IP) liegt NICHT in $SSH_SOURCE. Neue Anmeldungen von dort wären gesperrt."
      ask "Trotzdem dieses Netz verwenden? Tippe  ja  oder gib danach ein anderes Netz ein" "nein"
      [[ $ANSWER == ja ]] || { (( INTERACTIVE )) || break; continue; }
    fi
    break
  fi
  warn "Das ist kein gültiges Netz (Beispiel: 192.168.1.0/24)."
  (( INTERACTIVE )) || { SSH_SOURCE=192.168.1.0/24; break; }
done

LAN_ALL=0
if [[ $SSH_SOURCE != any ]]; then
  LAN_ALL_DEF=n; [[ $(conf_get LAN_ALL) == 1 ]] && LAN_ALL_DEF=j
  say "  Optional: Alle Geräte im Heimnetz dürfen auf ALLE Ports dieses Rechners (z. B. Dateifreigabe, Smart-Home-Oberfläche)."
  ask "Heimnetz $SSH_SOURCE auf alle Ports zulassen? j/n" "$LAN_ALL_DEF"
  [[ $ANSWER == j || $ANSWER == J || $ANSWER == ja ]] && LAN_ALL=1
fi

# TCP-Ports (ohne SSH)
TCP_DEF=$(conf_get EXTRA_TCP_PORTS)
if [[ -z $TCP_DEF ]]; then
  TCP_DEF=$(for p in $PUB_TCP; do [[ $p != "$SSH_PORT" && $p != 8787 ]] && echo "$p"; done | tr '\n' ' ' | sed 's/ $//' || true)
fi
say "  TCP-Ports, die von AUSSEN erreichbar bleiben sollen (außer SSH), durch Leerzeichen getrennt."
say "  Vorschlag = alles, was gerade lauscht. Streiche, was nicht von außen erreichbar sein muss (Datenbanken, Weboberflächen)."
while :; do
  ask "TCP-Ports (z. B. 25565 für Minecraft)" "$TCP_DEF"
  if valid_ports "$ANSWER"; then EXTRA_TCP=$(norm_ports "$ANSWER"); break; fi
  warn "Nur Zahlen zwischen 1 und 65535."
  (( INTERACTIVE )) || { EXTRA_TCP=""; break; }
done

MC_DEF=$(conf_get MINECRAFT_PORT)
if [[ -z $MC_DEF ]]; then
  for p in $EXTRA_TCP; do [[ $p == 25565 ]] && MC_DEF=25565; done
fi
# Ohne erkannten Minecraft-Port (z. B. weil er gerade gestoppt ist) gilt trotzdem 25565 als Vorgabe: "keine Angabe" gibt es nur durch ausdrückliches Tippen von  keiner.
MC_DEF=${MC_DEF:-25565}
while :; do
  ask "Minecraft-Port (tippe  keiner , wenn hier KEIN Minecraft läuft)" "$MC_DEF"
  if [[ $ANSWER == keiner ]]; then MINECRAFT_PORT=""; break; fi
  if valid_ports "$ANSWER" && [[ $ANSWER != *" "* ]]; then MINECRAFT_PORT=$((10#$ANSWER)); break; fi
  warn "Bitte genau eine Portnummer (oder  keiner  tippen, wenn hier kein Minecraft läuft)."
  (( INTERACTIVE )) || { MINECRAFT_PORT=$MC_DEF; break; }
done
if [[ -n $MINECRAFT_PORT ]]; then
  case " $EXTRA_TCP " in *" $MINECRAFT_PORT "*) ;; *) EXTRA_TCP=$(norm_ports "$EXTRA_TCP $MINECRAFT_PORT"); info "Minecraft-Port $MINECRAFT_PORT zur TCP-Liste hinzugefügt." ;; esac
fi
[[ $MINECRAFT_PORT == "$SSH_PORT" ]] && die "Minecraft-Port und SSH-Port sind gleich ($SSH_PORT)."

UDP_DEF=$(conf_get UDP_PORTS)
say "  UDP-Ports, die offen bleiben müssen (z. B. 24454 für Simple Voice Chat, 19132 für Bedrock/Geyser). Normalerweise leer."
if [[ -n $PUB_UDP ]]; then say "  Aktuell lauschen auf UDP: $PUB_UDP"; fi
while :; do
  ask "UDP-Ports" "${UDP_DEF:-}"
  if valid_ports "$ANSWER"; then UDP_PORTS=$(norm_ports "$ANSWER"); break; fi
  warn "Nur Zahlen zwischen 1 und 65535."
  (( INTERACTIVE )) || { UDP_PORTS=""; break; }
done

ALL_TCP=$(norm_ports "$SSH_PORT $EXTRA_TCP")

# SSH-Härtung: nötig?
SSH_DROPIN=/etc/ssh/sshd_config.d/00-antwars.conf
SSH_STEP=1
SSH_ROOT_OFF=0
SSH_SKIP_REASON=""
if [[ -z $ADMIN_USER || $ADMIN_USER == root ]]; then
  SSH_STEP=0; SSH_SKIP_REASON="kein Admin-Benutzer ungleich root angegeben"
else
  if id -nG "$ADMIN_USER" 2>/dev/null | tr ' ' '\n' | grep -qxE 'sudo|admin'; then SSH_ROOT_OFF=1; fi
  ADMIN_HOME=$(getent passwd "$ADMIN_USER" | cut -d: -f6)
  AK="$ADMIN_HOME/.ssh/authorized_keys"
  KEYS=0
  if [[ -r $AK ]] && have ssh-keygen; then
    KEYS=$(ssh-keygen -l -f "$AK" 2>/dev/null | wc -l || true)
  elif [[ -r $AK ]]; then
    KEYS=$(grep -cE '^(ssh-|ecdsa-|sk-)' "$AK" || true)
  fi
  if (( KEYS < 1 )); then
    SSH_STEP=0; SSH_SKIP_REASON="in $AK liegt kein gültiger Schlüssel (oder die Datei ist für diesen Lauf nicht lesbar)"
  fi
fi
ssh_dropin_content() {
  cat <<SSHEOF
# Von Antwars harden.sh. Kommt absichtlich zuerst (00-), weil bei sshd der erste Wert gewinnt.
PasswordAuthentication no
KbdInteractiveAuthentication no
SSHEOF
  if (( SSH_ROOT_OFF )); then echo "PermitRootLogin no"; fi
}
if (( SSH_STEP )) && [[ -f $SSH_DROPIN ]] && [[ "$(ssh_dropin_content)" == "$(cat "$SSH_DROPIN")" ]]; then
  info "SSH ist schon gehärtet (Datei $SSH_DROPIN passt), keine Rückfrage nötig."
  SSH_KEY_CONFIRMED=1
else
  SSH_KEY_CONFIRMED=0
  if (( SSH_STEP )); then
    say "  SSH-Passwort-Login wird ausgeschaltet. Schlüssel von '$ADMIN_USER': $KEYS gefunden in $AK."
    say "  Prüfe das jetzt: Melde dich in einem ZWEITEN Terminal mit dem Schlüssel an."
    ask "Hast du dich mit dem Schlüssel (nicht mit Passwort) angemeldet und es hat geklappt? j/n" "n"
    if [[ $ANSWER == j || $ANSWER == J || $ANSWER == ja ]]; then SSH_KEY_CONFIRMED=1; fi
    if (( ! SSH_KEY_CONFIRMED )); then
      SSH_STEP=0; SSH_SKIP_REASON="Schlüssel-Anmeldung nicht bestätigt"
    fi
  fi
fi

# ---------------------------------------------------------------- 3. Plan
hr "3. Plan"
say "  Admin-Benutzer:         ${ADMIN_USER:-keiner}"
say "  SSH:                    Port $SSH_PORT, erlaubt von: $( [[ $SSH_SOURCE == any ]] && echo 'ÜBERALL (auf deinen Wunsch)' || echo "$SSH_SOURCE" )"
say "  Weitere TCP-Ports offen: ${EXTRA_TCP:-keine}"
say "  UDP-Ports offen:        ${UDP_PORTS:-keine}"
if [[ -n $MINECRAFT_PORT ]]; then say "  Minecraft-Port:         $MINECRAFT_PORT"
else say "  Minecraft-Port:         KEINER  -> ACHTUNG: Minecraft-Spieler werden ausgesperrt, sofern Minecraft hier läuft!"; fi
say "  Heimnetz auf alle Ports: $( ((LAN_ALL)) && echo "ja ($SSH_SOURCE)" || echo nein )"
say "  Alles andere eingehend: VERBOTEN (ufw default deny incoming). Ausgehend bleibt erlaubt."
say "  Der Spielserver (8787) lauscht nur auf 127.0.0.1 und wird NICHT freigegeben. Der Tunnel braucht nur ausgehende Verbindungen."
say ""
say "  Schritte (schon Erledigtes wird übersprungen):"
say "   a) Pakete installieren, falls nötig: ufw fail2ban unattended-upgrades git curl gnupg ca-certificates"
say "   b) Benutzer 'antwars' und 'cloudflared' (ohne Login, ohne Home-Dateien) anlegen"
say "   c) Verzeichnisse /opt/antwars, /etc/antwars, /etc/cloudflared; Sperrliste anlegen (nur wenn sie fehlt)"
say "   d) Node.js 22 über das signierte NodeSource-Repository, falls noch nicht vorhanden"
say "   e) journald-Größenlimit (SystemMaxUse=200M): ältere Einträge bei Überschreitung werden gelöscht"
say "   f) fail2ban für SSH und automatische Sicherheitsupdates (ohne automatischen Neustart)"
if (( SSH_STEP )); then
  say "   g) SSH: Passwort-Login aus$( ((SSH_ROOT_OFF)) && echo ', Root-Login aus' ) (Drop-in $SSH_DROPIN, wird mit 'sshd -t' geprüft, sonst zurückgenommen)"
else
  say "   g) SSH wird NICHT geändert: $SSH_SKIP_REASON"
fi
say "   h) ufw: erst SSH-Regel, dann die Port-Liste, dann 'deny incoming', dann einschalten"
say "   i) Entscheidungen in /etc/antwars/harden.conf festhalten (liest check.sh)"
say "  Sicherungen: $BACKUP_DIR"

if (( DRY )); then
  say ""
  say "TROCKENLAUF: Es folgt die Liste der Befehle. Nichts davon wird ausgeführt."
else
  say ""
  say "  SSH-Sperre vermeiden: Lass dieses Terminal OFFEN und teste danach in einem zweiten Terminal die Anmeldung, bevor du dieses schließt."
  read -r -p "  Zum Fortfahren tippe genau  JA-AENDERN  : " CONFIRM || CONFIRM=""
  [[ $CONFIRM == "JA-AENDERN" ]] || die "Nicht bestätigt, es wurde nichts geändert."
fi

# ---------------------------------------------------------------- a) Pakete
hr "a) Pakete"
PKGS=(ufw fail2ban unattended-upgrades git curl gnupg ca-certificates)
MISSING=()
for p in "${PKGS[@]}"; do pkg_installed "$p" || MISSING+=("$p"); done
if (( ${#MISSING[@]} == 0 )); then
  info "schon in Ordnung: alle Pakete installiert"
else
  info "fehlend: ${MISSING[*]}"
  run apt-get update
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y "${MISSING[@]}"
  (( DRY )) || changed "Pakete installiert: ${MISSING[*]}"
fi

# ---------------------------------------------------------------- b) Benutzer
hr "b) Dienst-Benutzer"
ensure_user() { # $1 Name $2 Home
  local n=$1 h=$2
  if id -u "$n" >/dev/null 2>&1; then
    info "schon in Ordnung: Benutzer $n"
    [[ $(getent passwd "$n" | cut -d: -f7) == /usr/sbin/nologin ]] || warn "Benutzer $n hat eine andere Shell als /usr/sbin/nologin. Bitte prüfen."
  else
    run useradd --system --user-group --home-dir "$h" --no-create-home --shell /usr/sbin/nologin "$n"
    (( DRY )) || { note_new "Benutzer:$n"; changed "Benutzer $n angelegt"; }
  fi
}
ensure_user antwars /opt/antwars
ensure_user cloudflared /nonexistent

# ---------------------------------------------------------------- c) Verzeichnisse
hr "c) Verzeichnisse"
# Der Dienst darf den Code nur LESEN: alles gehört root, niemand sonst darf schreiben.
ensure_dir /opt/antwars 755 root:root
ensure_dir /etc/antwars 755 root:root
ensure_dir /etc/cloudflared 755 root:root
if [[ -e /etc/antwars/blocklist.txt ]]; then
  info "Sperrliste existiert, bleibt unangetastet: /etc/antwars/blocklist.txt"
  if (( ! DRY )); then
    # Rechte angleichen, Inhalt nie anfassen
    if [[ $(stat -c '%a %U:%G' /etc/antwars/blocklist.txt) != "640 root:antwars" ]]; then
      backup /etc/antwars/blocklist.txt
      chown root:antwars /etc/antwars/blocklist.txt; chmod 640 /etc/antwars/blocklist.txt
      changed "Rechte der Sperrliste gesetzt (640 root:antwars)"
    fi
  fi
else
  put_file /etc/antwars/blocklist.txt 640 root:antwars <<'BLEOF'
# Sperrliste des Antwars-Servers.
# Pro Zeile ein Eintrag: eine IP-Adresse ODER eine Supabase-Nutzer-ID (UUID).
# Alles ab einem # ist Kommentar. Leerzeilen sind erlaubt (Zeilen bis 128 Zeichen).
# Der Server liest die Datei alle 30 Sekunden neu ein, ein Neustart ist nicht nötig.
# Beispiele (ohne # eintragen):
#   203.0.113.7
#   2b7d8c1e-0000-0000-0000-000000000000
BLEOF
fi

# ---------------------------------------------------------------- d) Node.js 22
hr "d) Node.js 22"
NODE_MAJOR=22
cur_node=0
if have node; then cur_node=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0); fi
if (( cur_node >= NODE_MAJOR )); then
  info "schon in Ordnung: Node $(node -v)"
else
  info "Gefundene Node-Hauptversion: $cur_node (0 = nicht installiert). Gebraucht wird $NODE_MAJOR oder neuer."
  KEYRING=/etc/apt/keyrings/nodesource.gpg
  LISTFILE=/etc/apt/sources.list.d/nodesource.list
  KEY_URL=https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key
  if (( DRY )); then
    run mkdir -p /etc/apt/keyrings
    run curl -fsSL --proto '=https' --tlsv1.2 -o /tmp/nodesource-repo.gpg.key "$KEY_URL"
    info "(dann: Fingerabdruck und SHA-256 des Schlüssels anzeigen, von dir bestätigen lassen)"
    run gpg --dearmor --yes -o "$KEYRING" /tmp/nodesource-repo.gpg.key
    info "würde schreiben: $LISTFILE"
    info "        | deb [arch=$(dpkg --print-architecture 2>/dev/null || echo amd64) signed-by=$KEYRING] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main"
    run apt-get update
    run env DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  else
    mkdir -p /etc/apt/keyrings
    KEYTMP=$(mktemp)
    curl -fsSL --proto '=https' --tlsv1.2 -o "$KEYTMP" "$KEY_URL"
    say "  Heruntergeladener NodeSource-Schlüssel:"
    sha256sum "$KEYTMP" | sed 's/^/    SHA-256: /'
    gpg --show-keys --with-fingerprint "$KEYTMP" 2>/dev/null | sed 's/^/    /' || true
    say "  NodeSource veröffentlicht keine Prüfsumme. Vergleiche den Fingerabdruck mit der Angabe auf https://github.com/nodesource/distributions (README/Wiki), wenn du ganz sicher gehen willst."
    ask "Weiter mit diesem Schlüssel? j/n" "n"
    [[ $ANSWER == j || $ANSWER == J || $ANSWER == ja ]] || { rm -f "$KEYTMP"; die "Abgebrochen. Bisher Erledigtes bleibt, ein neuer Lauf macht weiter."; }
    [[ -e $KEYRING ]] && backup "$KEYRING" || note_new "$KEYRING"
    gpg --dearmor --yes -o "$KEYRING" "$KEYTMP"
    chmod 644 "$KEYRING"
    rm -f "$KEYTMP"
    printf 'deb [arch=%s signed-by=%s] https://deb.nodesource.com/node_%s.x nodistro main\n' "$(dpkg --print-architecture)" "$KEYRING" "$NODE_MAJOR" >"$LISTFILE.tmp"
    if [[ -e $LISTFILE ]]; then backup "$LISTFILE"; else note_new "$LISTFILE"; fi
    mv "$LISTFILE.tmp" "$LISTFILE"
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
    new_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
    (( new_major >= NODE_MAJOR )) || die "Nach der Installation ist Node $(node -v 2>/dev/null || echo '?') aktiv, nicht $NODE_MAJOR. Prüfe:  apt-cache policy nodejs"
    changed "Node.js $(node -v) installiert"
  fi
fi

# ---------------------------------------------------------------- e) journald
hr "e) journald-Größenlimit"
put_file /etc/systemd/journald.conf.d/antwars.conf 644 root:root <<'JEOF'
# Von Antwars harden.sh: Protokolle (inkl. Minecraft, falls es ins Journal schreibt) auf 200 MB begrenzen.
[Journal]
SystemMaxUse=200M
JEOF
if (( LAST_CHANGED && ! DRY )); then systemctl restart systemd-journald; info "journald neu gestartet"; fi

# ---------------------------------------------------------------- f) fail2ban, Updates
hr "f) fail2ban und automatische Sicherheitsupdates"
IGNORE="127.0.0.1/8 ::1"
[[ $SSH_SOURCE != any ]] && IGNORE="$IGNORE $SSH_SOURCE"
put_file /etc/fail2ban/jail.d/antwars.local 644 root:root <<F2EOF
# Von Antwars harden.sh: SSH-Anmeldeversuche begrenzen.
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
ignoreip = $IGNORE

[sshd]
enabled = true
port = $SSH_PORT
F2EOF
if (( DRY )); then
  run systemctl enable --now fail2ban
else
  if ! systemctl is-enabled --quiet fail2ban || ! systemctl is-active --quiet fail2ban; then
    systemctl enable --now fail2ban; changed "fail2ban aktiviert und gestartet"
  elif (( LAST_CHANGED )); then
    systemctl restart fail2ban; info "fail2ban neu gestartet"
  fi
fi
put_file /etc/apt/apt.conf.d/20auto-upgrades 644 root:root <<'UEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
UEOF

# ---------------------------------------------------------------- g) SSH
hr "g) SSH-Härtung"
if (( ! SSH_STEP )); then
  info "übersprungen: $SSH_SKIP_REASON"
else
  SSHD=$(command -v sshd || echo /usr/sbin/sshd)
  if (( DRY )); then
    put_file "$SSH_DROPIN" 644 root:root < <(ssh_dropin_content)
    run "$SSHD" -t
    run systemctl reload ssh
  else
    put_file "$SSH_DROPIN" 644 root:root < <(ssh_dropin_content)
    if (( LAST_CHANGED )); then
      if ! "$SSHD" -t 2>/dev/null; then
        warn "sshd meldet einen Fehler in der Konfiguration. Die neue Datei wird entfernt, SSH bleibt unverändert."
        rm -f "$SSH_DROPIN"
        [[ -e "$BACKUP_DIR$SSH_DROPIN" ]] && cp -a "$BACKUP_DIR$SSH_DROPIN" "$SSH_DROPIN"
        die "SSH-Härtung zurückgenommen."
      fi
      if ! "$SSHD" -T 2>/dev/null | grep -qi '^passwordauthentication no$'; then
        warn "Eine andere Konfigurationsdatei überschreibt die Einstellung (PasswordAuthentication ist noch nicht 'no'). Die neue Datei wird entfernt."
        rm -f "$SSH_DROPIN"
        [[ -e "$BACKUP_DIR$SSH_DROPIN" ]] && cp -a "$BACKUP_DIR$SSH_DROPIN" "$SSH_DROPIN"
        die "SSH-Härtung zurückgenommen. Prüfe:  sudo sshd -T | grep -i passwordauth"
      fi
      systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || warn "Konnte den SSH-Dienst nicht neu laden. Neue Verbindungen lesen die neue Konfiguration trotzdem."
      info "SSH neu geladen. Bestehende Sitzungen bleiben offen."
      say ""
      say "  >>> Teste in einem zweiten Terminal, bevor du dieses schließt:  ssh $ADMIN_USER@<Server> <<<"
      say "  >>> Klappt es dort nicht, mache hier die Änderung rückgängig:  sudo rm $SSH_DROPIN && sudo systemctl reload ssh"
      say ""
    fi
  fi
fi

# ---------------------------------------------------------------- h) ufw
hr "h) Firewall (ufw)"
UFW_RULES=()  # jede Regel als Argumente-String für 'ufw allow'
if [[ $SSH_SOURCE == any ]]; then UFW_RULES+=("${SSH_PORT}/tcp")
else UFW_RULES+=("from $SSH_SOURCE to any port $SSH_PORT proto tcp"); fi
for p in $EXTRA_TCP; do UFW_RULES+=("$p/tcp"); done
for p in $UDP_PORTS; do UFW_RULES+=("$p/udp"); done
(( LAN_ALL )) && UFW_RULES+=("from $SSH_SOURCE")
# Hinweis: Die Heimnetz-Regeln gelten nur für IPv4 (CIDR). Aus einem IPv6-Netz kommt man per SSH nur über die allgemeine SSH-Regel (SSH_SOURCE=ALLE).

if (( DRY )); then
  have ufw || info "(ufw ist noch nicht installiert, wird in Schritt a) installiert)"
  info "(vor einer nötigen Änderung werden /etc/ufw und /etc/default/ufw nach $BACKUP_DIR gesichert)"
  for r in "${UFW_RULES[@]}"; do run ufw allow $r; done
  run ufw default deny incoming
  run ufw default allow outgoing
  run ufw --force enable
else
  have ufw || die "ufw ist nicht installiert."
  UFW_ACTIVE=0; ufw status 2>/dev/null | grep -q '^Status: active' && UFW_ACTIVE=1
  UFW_DEFAULT_OK=0; (( UFW_ACTIVE )) && ufw status verbose 2>/dev/null | grep -q 'deny (incoming), allow (outgoing)' && UFW_DEFAULT_OK=1
  NEED_UFW=0
  (( UFW_ACTIVE && UFW_DEFAULT_OK )) || NEED_UFW=1
  if (( ! NEED_UFW )); then
    ADDED=$(ufw show added 2>/dev/null || true)
    for r in "${UFW_RULES[@]}"; do
      # Regel gilt als vorhanden, wenn 'ufw show added' sie auflistet oder ein Probelauf "Skipping" meldet.
      # Im Zweifel wird die (selbst idempotente) Regel einfach erneut gesetzt.
      grep -Fxq "ufw allow $r" <<<"$ADDED" && continue
      out=$(ufw --dry-run allow $r 2>&1 || true)
      grep -qi 'skipping' <<<"$out" || NEED_UFW=1
    done
  fi
  if (( ! NEED_UFW )); then
    info "schon in Ordnung: ufw aktiv, Standard 'deny incoming', alle Regeln vorhanden"
  else
    backup /etc/ufw; backup /etc/default/ufw
    mkdir -p "$BACKUP_DIR"; ufw status numbered >"$BACKUP_DIR/ufw-status-vorher.txt" 2>&1 || true
    # Reihenfolge: zuerst SSH (erste Regel), dann der Rest, dann Verbotsregel, ganz zuletzt einschalten.
    for r in "${UFW_RULES[@]}"; do
      printf '    $ ufw allow %s\n' "$r"
      ufw allow $r
    done
    printf '    $ ufw default deny incoming\n'; ufw default deny incoming
    printf '    $ ufw default allow outgoing\n'; ufw default allow outgoing
    if (( ! UFW_ACTIVE )); then printf '    $ ufw --force enable\n'; ufw --force enable; fi
    changed "ufw konfiguriert"
    ufw status verbose | sed 's/^/    /'
    say ""
    say "  >>> Teste in einem zweiten Terminal (SSH) und mit Minecraft, bevor du dieses Terminal schließt. <<<"
  fi
fi

# ---------------------------------------------------------------- i) Festhalten
hr "i) Entscheidungen festhalten"
put_file /etc/antwars/harden.conf 644 root:root <<CEOF
# Von Antwars harden.sh geschrieben. check.sh liest diese Datei. Nicht von Hand ändern, harden.sh neu laufen lassen.
ADMIN_USER=$ADMIN_USER
SSH_PORT=$SSH_PORT
SSH_SOURCE=$SSH_SOURCE
LAN_ALL=$LAN_ALL
EXTRA_TCP_PORTS="$EXTRA_TCP"
TCP_PORTS="$ALL_TCP"
UDP_PORTS="$UDP_PORTS"
MINECRAFT_PORT=$MINECRAFT_PORT
CEOF

# ---------------------------------------------------------------- Ende
hr "Fertig"
if (( DRY )); then
  say "TROCKENLAUF beendet. Nichts wurde geändert."
elif (( CHANGES == 0 )); then
  say "Nichts zu tun: alles war schon in Ordnung (idempotent)."
else
  say "$CHANGES Änderung(en) durchgeführt. Sicherungen: $BACKUP_DIR"
  say "Nächster Schritt laut Anleitung: Dateien nach /opt/antwars bringen, dann deploy/check.sh ausführen."
fi
exit 0
