#!/usr/bin/env bash
# Prüft den Spielserver. Gibt je Zeile OK oder FEHLER aus. Keine Änderungen.
set -u
ok=0; bad=0
say(){ if [ "$1" -eq 0 ]; then echo "OK      $2"; ok=$((ok+1)); else echo "FEHLER  $2"; bad=$((bad+1)); fi; }

# 1. Port 8787 nur auf 127.0.0.1
if command -v ss >/dev/null 2>&1; then
  lines=$(ss -ltnp 2>/dev/null | grep -E ':8787\b' || true)
  if echo "$lines" | grep -q '127\.0\.0\.1:8787'; then
    if echo "$lines" | grep -vq '127\.0\.0\.1:8787'; then say 1 "Port 8787 lauscht auch außerhalb von 127.0.0.1"; else say 0 "Port 8787 nur auf 127.0.0.1"; fi
  else
    say 1 "Port 8787 lauscht nicht auf 127.0.0.1"
  fi
  other=$(ss -ltnp 2>/dev/null | grep -vE ':(22|80|443|8787|25565|19132)\b' | grep -v '127\.0\.0\.1' || true)
  [ -z "$other" ]; say $? "keine unerwarteten öffentlichen Ports"
else
  say 1 "ss fehlt (iproute2 installieren)"
fi

# 2. Dienst
systemctl is-active --quiet antwars-server; say $? "Dienst antwars-server läuft"
if command -v systemd-analyze >/dev/null 2>&1; then
  score=$(systemd-analyze security antwars-server --no-pager 2>/dev/null | grep -oE 'Exposure level:.*' || true)
  echo "INFO    $score"
fi

# 3. Benutzer
u=$(systemctl show antwars-server -p User --value 2>/dev/null)
[ "$u" = "antwars" ]; say $? "Dienst läuft als Benutzer antwars (ist: ${u:-?})"

# 4. Firewall
if command -v ufw >/dev/null 2>&1; then
  ufw status 2>/dev/null | grep -q "Status: active"; say $? "ufw ist aktiv"
else
  say 1 "ufw fehlt"
fi

# 5. SSH: kein Passwort-Login
if grep -RqsE '^\s*PasswordAuthentication\s+yes' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null; then
  say 1 "SSH erlaubt Passwort-Login"
else
  say 0 "SSH-Passwort-Login ist aus"
fi

# 6. Rechte
if [ -d /opt/antwars ]; then
  perm=$(find /opt/antwars -maxdepth 0 -printf '%m %u' 2>/dev/null || stat -c '%a %U' /opt/antwars 2>/dev/null)
  case "$perm" in
    755\ antwars|750\ antwars|700\ antwars) say 0 "/opt/antwars gehört antwars (${perm})" ;;
    *) say 1 "/opt/antwars gehört nicht antwars (${perm:-?})" ;;
  esac
else
  say 1 "/opt/antwars fehlt"
fi

# 7. Erreichbarkeit lokal
if command -v curl >/dev/null 2>&1; then
  curl -fsS --max-time 3 http://127.0.0.1:8787/healthz | grep -qx ok; say $? "GET /healthz antwortet ok"
else
  say 1 "curl fehlt"
fi

echo
echo "Ergebnis: $ok OK, $bad FEHLER"
[ "$bad" -eq 0 ]
