#!/usr/bin/env bash
# Antwars: Zustand prüfen. Liest nur, ändert nichts.
#   sudo ./check.sh        (mit root sind alle Prüfungen möglich)
# Je Zeile: OK, FEHLER oder HINWEIS. Rückgabewert 0 nur, wenn es kein FEHLER gibt UND nichts übersprungen wurde
# (ohne root: Rückgabewert 2, weil ufw- und SSH-Prüfung fehlen).
set -Eeuo pipefail

N_OK=0; N_ERR=0; N_HINT=0
ok()      { N_OK=$((N_OK + 1));     printf 'OK      %s\n' "$*"; }
fehler()  { N_ERR=$((N_ERR + 1));   printf 'FEHLER  %s\n' "$*"; }
hinweis() { N_HINT=$((N_HINT + 1)); printf 'HINWEIS %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
IS_ROOT=0; [[ $EUID -eq 0 ]] && IS_ROOT=1

CONF=/etc/antwars/harden.conf
conf_get() { [[ -r $CONF ]] && sed -n "s/^$1=//p" "$CONF" | head -n1 | tr -d '"' || true; }
APP_DIR=/opt/antwars
PORT=8787
GRENZE=5.0

echo "Antwars-Prüfung ($(date '+%Y-%m-%d %H:%M'))"
SKIPPED=0
(( IS_ROOT )) || { SKIPPED=1; hinweis "Nicht als root gestartet: Prüfungen für ufw und SSH sind nur mit  sudo ./check.sh  möglich."; }

HAVE_CONF=0
if [[ -r $CONF ]]; then HAVE_CONF=1; else hinweis "$CONF fehlt: harden.sh ist noch nicht gelaufen. Prüfungen gegen die erlaubte Portliste entfallen."; fi
ALLOWED_TCP=""; MC_PORT=""; SSH_PORT=""; SSH_SOURCE=""; LAN_ALL=0; ALLOWED_UDP=""
if (( HAVE_CONF )); then
  ALLOWED_TCP=$(conf_get TCP_PORTS); MC_PORT=$(conf_get MINECRAFT_PORT); SSH_PORT=$(conf_get SSH_PORT)
  SSH_SOURCE=$(conf_get SSH_SOURCE); LAN_ALL=$(conf_get LAN_ALL); ALLOWED_UDP=$(conf_get UDP_PORTS)
  LAN_ALL=${LAN_ALL:-0}
fi

# ---- 1. Spielserver lauscht nur auf 127.0.0.1:8787
if have ss; then
  MATCH=$(ss -H -ltn 2>/dev/null | awk -v p=":$PORT" '{a=$4; n=length(a)-length(p)+1; if (n>0 && substr(a,n)==p) print a}' || true)
  if [[ -z $MATCH ]]; then
    fehler "Der Spielserver lauscht nicht auf Port $PORT (Dienst läuft nicht?)."
  else
    BAD=$(grep -vE '^127\.0\.0\.1:' <<<"$MATCH" || true)
    if [[ -n $BAD ]]; then fehler "Port $PORT lauscht auf mehr als 127.0.0.1: $(tr '\n' ' ' <<<"$BAD")"
    else ok "Spielserver lauscht nur auf 127.0.0.1:$PORT"; fi
  fi

  # ---- 2. Keine neuen öffentlichen Ports
  if (( HAVE_CONF )); then
    PUB=$(ss -H -ltn 2>/dev/null | awk '{a=$4; if (a ~ /^127\./ || a ~ /^\[::1\]:/) next; n=split(a,p,":"); print p[n]}' | sort -un || true)
    UNEXPECTED=""
    for p in $PUB; do
      case " $ALLOWED_TCP " in *" $p "*) ;; *) UNEXPECTED="$UNEXPECTED $p" ;; esac
    done
    if [[ -n $UNEXPECTED ]]; then fehler "Unerwartete öffentlich lauschende TCP-Ports:$UNEXPECTED (erlaubt laut harden.sh: ${ALLOWED_TCP:-keine})"
    else ok "Keine öffentlichen TCP-Ports außer den von harden.sh erlaubten (${ALLOWED_TCP:-keine})"; fi
    PUBU=$(ss -H -lun 2>/dev/null | awk '{a=$4; if (a ~ /^127\./ || a ~ /^\[::1\]:/) next; n=split(a,p,":"); print p[n]}' | sort -un || true)
    UNEXU=""
    for p in $PUBU; do
      case " $ALLOWED_UDP " in *" $p "*) ;; *) UNEXU="$UNEXU $p" ;; esac
    done
    [[ -n $UNEXU ]] && hinweis "Öffentlich lauschende UDP-Ports:$UNEXU (nur mit ufw nach außen gesperrt, sofern nicht in der UDP-Liste)."
  fi

  # ---- 12. Minecraft
  if [[ -n $MC_PORT ]]; then
    if ss -H -ltn 2>/dev/null | awk -v p=":$MC_PORT" '{a=$4; n=length(a)-length(p)+1; if (n>0 && substr(a,n)==p) f=1} END{exit f?0:1}'; then
      ok "Minecraft-Port $MC_PORT lauscht"
    else
      fehler "Minecraft-Port $MC_PORT lauscht nicht (Minecraft aus? Oder anderer Port?)."
    fi
  else
    hinweis "Kein Minecraft-Port aufgezeichnet, Prüfung übersprungen."
  fi
else
  hinweis "'ss' fehlt (Paket iproute2): Prüfungen der lauschenden Ports übersprungen."
fi

# ---- 3. Dienste aktiv
for u in antwars-server cloudflared; do
  if have systemctl && systemctl is-active --quiet "$u" 2>/dev/null; then ok "Dienst $u ist aktiv"
  else fehler "Dienst $u ist nicht aktiv (systemctl status $u)"; fi
done

# ---- 4. Prozess läuft als antwars, nicht als root
proc_user() { # $1 Dienst
  local pid
  pid=$(systemctl show -p MainPID --value "$1" 2>/dev/null || echo 0)
  [[ $pid =~ ^[0-9]+$ ]] && (( pid > 0 )) || return 1
  stat -c '%U' "/proc/$pid" 2>/dev/null
}
if have systemctl; then
  if U=$(proc_user antwars-server); then
    if [[ $U == antwars ]]; then ok "Spielserver läuft als Benutzer antwars"
    else fehler "Spielserver läuft als '$U', erwartet: antwars"; fi
  else
    fehler "Prozess des Spielservers nicht gefunden, Benutzer nicht prüfbar."
  fi
  if U=$(proc_user cloudflared); then
    if [[ $U == cloudflared ]]; then ok "cloudflared läuft als Benutzer cloudflared"
    else fehler "cloudflared läuft als '$U', erwartet: cloudflared"; fi
  else
    fehler "Prozess von cloudflared nicht gefunden, Benutzer nicht prüfbar."
  fi
fi

# ---- 5. systemd-analyze security
if have systemd-analyze; then
  SEC=$(systemd-analyze security antwars-server --no-pager 2>/dev/null || true)
  SCORE=$(grep -oE 'Overall exposure level for [^:]+: [0-9]+(\.[0-9]+)?' <<<"$SEC" | tail -n1 | grep -oE '[0-9]+(\.[0-9]+)?$' || true)
  if [[ -z $SCORE ]]; then
    hinweis "Expositionswert von antwars-server nicht ermittelbar (Dienst nicht installiert?)."
  elif awk -v s="$SCORE" -v g="$GRENZE" 'BEGIN{exit (s+0 < g+0) ? 0 : 1}'; then
    ok "systemd-analyze security: Exposition $SCORE (Grenze $GRENZE)"
  else
    fehler "systemd-analyze security: Exposition $SCORE ist nicht unter $GRENZE"
  fi
else
  hinweis "systemd-analyze fehlt: Härtungswert nicht geprüft."
fi

# ---- 6. ufw
if (( IS_ROOT )) && have ufw; then
  UFW=$(ufw status verbose 2>/dev/null || true)
  if ! grep -q '^Status: active' <<<"$UFW"; then
    fehler "ufw ist nicht aktiv."
  else
    ok "ufw ist aktiv"
    if grep -q 'deny (incoming)' <<<"$UFW"; then ok "ufw: eingehend standardmäßig verboten"
    else fehler "ufw: Standard für eingehend ist nicht 'deny'."; fi
    if (( HAVE_CONF )); then
      # Regeln als "tcp:PORT" / "udp:PORT" einsammeln (ohne v6-Duplikate)
      RULES=$(ufw status 2>/dev/null | awk '/ALLOW/ && !/\(v6\)/ {print $1}' | sort -u || true)
      MISSING=""
      for p in $ALLOWED_TCP; do
        grep -qxE "$p(/tcp)?" <<<"$RULES" || MISSING="$MISSING $p/tcp"
      done
      for p in $ALLOWED_UDP; do
        grep -qxF "$p/udp" <<<"$RULES" || MISSING="$MISSING $p/udp"
      done
      if [[ -n $MISSING ]]; then fehler "ufw-Regeln fehlen für:$MISSING"
      else ok "ufw-Regeln enthalten alle aufgezeichneten Ports"; fi
      EXTRA=""
      for r in $RULES; do
        pr=${r%/*}
        if [[ $r == Anywhere ]]; then (( LAN_ALL == 1 )) || EXTRA="$EXTRA <alle Ports von irgendwo>"; continue; fi
        case "$r" in
          */udp) case " $ALLOWED_UDP " in *" $pr "*) continue ;; esac ;;
          *) case " $ALLOWED_TCP " in *" $pr "*) continue ;; esac ;;
        esac
        EXTRA="$EXTRA $r"
      done
      [[ -n $EXTRA ]] && hinweis "Zusätzliche ufw-Erlaubnisregeln, die harden.sh nicht kennt:$EXTRA (prüfen:  sudo ufw status numbered)"
      if [[ $SSH_SOURCE != any && -n $SSH_SOURCE && -n $SSH_PORT ]]; then
        if ufw status | awk -v p="$SSH_PORT" '$1 ~ ("^" p "(/tcp)?$") && /ALLOW/ && $0 ~ /Anywhere *(\(v6\))? *$/ {f=1} END{exit f?0:1}'; then
          hinweis "SSH-Port $SSH_PORT ist zusätzlich von überall erlaubt (alte Regel?). Sollte nur aus $SSH_SOURCE erreichbar sein."
        fi
      fi
    fi
  fi
else
  hinweis "ufw-Prüfung braucht root und das Programm ufw (sudo ./check.sh)."
fi

# ---- 7. SSH
SSHD=$(command -v sshd || true); [[ -z $SSHD && -x /usr/sbin/sshd ]] && SSHD=/usr/sbin/sshd
if (( IS_ROOT )) && [[ -n $SSHD ]]; then
  T=$("$SSHD" -T 2>/dev/null || true)
  if [[ -z $T ]]; then hinweis "sshd -T lieferte nichts (SSH nicht installiert?)."
  else
    if grep -qix 'passwordauthentication no' <<<"$T"; then ok "SSH: Passwort-Login ist aus (sshd -T)"
    else fehler "SSH: PasswordAuthentication ist NICHT 'no' (sudo sshd -T | grep -i passwordauth)"; fi
    grep -qix 'kbdinteractiveauthentication no' <<<"$T" || hinweis "SSH: KbdInteractiveAuthentication ist nicht 'no'."
    grep -qiE '^permitrootlogin (no|prohibit-password|without-password)$' <<<"$T" || hinweis "SSH: Root-Login mit Passwort ist erlaubt."
  fi
else
  hinweis "SSH-Prüfung braucht root und sshd (sudo ./check.sh)."
fi

# ---- 8. unattended-upgrades
if have apt-config && dpkg-query -W -f='${Status}' unattended-upgrades 2>/dev/null | grep -q '^install ok installed$'; then
  if apt-config dump 2>/dev/null | grep -qE '^APT::Periodic::Unattended-Upgrade "1";'; then ok "Automatische Sicherheitsupdates (unattended-upgrades) sind eingeschaltet"
  else fehler "unattended-upgrades ist installiert, aber nicht eingeschaltet (APT::Periodic::Unattended-Upgrade)."; fi
else
  fehler "unattended-upgrades ist nicht installiert."
fi

# ---- 9. fail2ban
if have systemctl && systemctl is-active --quiet fail2ban 2>/dev/null; then ok "fail2ban ist aktiv"
else fehler "fail2ban ist nicht aktiv."; fi

# ---- 10. Rechte auf /opt/antwars, 11. keine Geheimnisse
if [[ -d $APP_DIR ]]; then
  MODE=$(stat -c '%a' "$APP_DIR"); OWN=$(stat -c '%U' "$APP_DIR")
  WRITABLE=$(find "$APP_DIR" -xdev \( -path "$APP_DIR/.git" -prune \) -o \( ! -type l \( -perm -g+w -o -perm -o+w \) -print \) 2>/dev/null | head -n 5 || true)
  NOTROOT=$(find "$APP_DIR" -xdev \( -path "$APP_DIR/.git" -prune \) -o \( ! -user root -print \) 2>/dev/null | head -n 5 || true)
  if [[ $OWN != root ]]; then fehler "$APP_DIR gehört '$OWN', erwartet: root"
  elif [[ -n $WRITABLE ]]; then fehler "In $APP_DIR ist etwas für Gruppe/Andere schreibbar (Modus $MODE), z. B.: $(tr '\n' ' ' <<<"$WRITABLE")"
  elif [[ -n $NOTROOT ]]; then fehler "In $APP_DIR gehört etwas nicht root (der Dienst darf den Code nicht ändern können), z. B.: $(tr '\n' ' ' <<<"$NOTROOT")"
  else ok "$APP_DIR gehört root und ist für Gruppe/Andere nicht schreibbar"; fi

  SECRETNAMES=$(find "$APP_DIR" -xdev \( -path "$APP_DIR/.git" -o -path "$APP_DIR/node_modules" -o -path "$APP_DIR/server/node_modules" \) -prune -o -type f \( -name '*.pem' -o -name '*.key' -o -name 'tunnel.env' -o -name 'credentials*.json' -o -name '.env.local' \) -print 2>/dev/null | head -n 5 || true)
  SECRETTXT=$(grep -rIlE 'service_role|SERVICE_ROLE|TUNNEL_TOKEN|BEGIN [A-Z ]*PRIVATE KEY' "$APP_DIR" \
      --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=docs --exclude-dir=supabase --exclude-dir=deploy --exclude-dir=tests --exclude-dir=scripts 2>/dev/null | head -n 5 || true)
  if [[ -n $SECRETNAMES || -n $SECRETTXT ]]; then fehler "Mögliche Geheimnisse unter $APP_DIR: $(tr '\n' ' ' <<<"$SECRETNAMES $SECRETTXT")"
  else ok "Keine Geheimnisdateien unter $APP_DIR (.pem/.key/tunnel.env/service_role/TUNNEL_TOKEN)"; fi
else
  fehler "$APP_DIR existiert nicht."
fi
if [[ -e /etc/cloudflared/tunnel.env ]]; then
  TM=$(stat -c '%a %U:%G' /etc/cloudflared/tunnel.env)
  if [[ $TM == "600 root:root" ]]; then ok "Tunnel-Token-Datei hat Modus 600 und gehört root"
  else fehler "/etc/cloudflared/tunnel.env hat '$TM', erwartet: 600 root:root"; fi
else
  hinweis "/etc/cloudflared/tunnel.env existiert nicht (Tunnel noch nicht eingerichtet?)."
fi

echo
echo "Ergebnis: $N_OK OK, $N_HINT HINWEIS, $N_ERR FEHLER"
if (( N_ERR > 0 )); then exit 1; fi
if (( SKIPPED )); then
  echo "UNVOLLSTÄNDIG: ufw- und SSH-Prüfung wurden übersprungen (kein root). Das ist KEIN bestandener Test. Starte:  sudo ./check.sh"
  exit 2
fi
exit 0
