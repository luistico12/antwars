# Ant Wars auf dem eigenen Server

Diese Anleitung richtet öffentliche Matches auf einem Ubuntu-Heimserver ein. Die Welt
läuft in Node, der Server entscheidet, der Browser ist nur Anzeige und Kolonie. Der
Server hört **nur auf `127.0.0.1:8787`**; erreichbar wird er über einen Cloudflare
Tunnel. Am Router wird **kein Port** geöffnet, die Heim-IP bleibt verborgen.

Gemessene Richtwerte (`node server/test/load.js`, 10 Räume mit je 8 Menschen und Bots,
300 simulierte Sekunden): **77 MB RSS**, **0,8 % eines Kerns**. `MemoryMax=1G` in der
Dienstdatei lässt reichlich Luft und verdrängt Minecraft nicht.

---

## 1. Voraussetzungen

- Ubuntu 22.04/24.04 mit root-Zugang (sudo).
- Ein Cloudflare-Konto und eine Domain, deren Nameserver bei Cloudflare liegen.
- SSH nur mit Schlüssel. **Lege den Schlüssel an, bevor du Passwort-Login abschaltest.**

Prüfen:

```bash
ssh -i ~/.ssh/id_ed25519 user@server
```

Erwartet: Anmeldung ohne Passwortabfrage.

---

## 2. Härtung ausführen

```bash
sudo bash deploy/harden.sh --dry-run   # zeigt nur, was passieren würde
sudo bash deploy/harden.sh
```

Das Skript ist idempotent und macht:

- Benutzer `antwars` ohne Login-Shell, Verzeichnis `/opt/antwars`
- `ufw`: eingehend verbieten, SSH nur aus dem abgefragten Heimnetz, 80/443 frei,
  Minecraft 25565/tcp und 19132/udp. **8787 wird nicht geöffnet.**
- SSH: `PasswordAuthentication no` – nur wenn ein `authorized_keys` gefunden wurde
- `fail2ban`, `unattended-upgrades`, Node 22 über NodeSource

Prüfen:

```bash
ufw status
# Erwartet: Status: active, 22/tcp nur aus deinem Heimnetz

grep -R PasswordAuthentication /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
# Erwartet: PasswordAuthentication no
```

---

## 3. Projekt auf den Server bringen

```bash
sudo -u antwars git clone https://github.com/luistico12/antwars.git /opt/antwars
cd /opt/antwars/server
sudo -u antwars npm ci --omit=dev || sudo -u antwars npm install --omit=dev
```

Erwartet: `node_modules/ws` und `node_modules/jose` liegen in `/opt/antwars/server`.

Auf dem Spielserver liegt **kein Geheimnis**. Die Tokenprüfung nutzt ausschließlich die
öffentlichen Schlüssel des Supabase-Projekts (`/auth/v1/.well-known/jwks.json`). Die
Supabase-URL steht öffentlich in der Dienstdatei.

Kurztest von Hand:

```bash
sudo -u antwars SUPABASE_URL=https://hkrnduhssueijveffof.supabase.co node /opt/antwars/server/index.js
```

Erwartet: `Ant Wars Server läuft auf 127.0.0.1:8787`. Mit `Ctrl+C` beenden.
In einem zweiten Terminal:

```bash
curl -s http://127.0.0.1:8787/healthz
# Erwartet: ok
curl -s http://127.0.0.1:8787/matches
# Erwartet: [] (oder eine Liste ohne Namen, ohne sub, ohne pid)
```

---

## 4. Domain und Cloudflare Tunnel

### 4.1 Domain zu Cloudflare

1. In Cloudflare **Add a site** → Domain eintragen. Cloudflare liest die vorhandenen
   DNS-Einträge ein (Website, Mail/MX, ggf. TXT).
2. **Vor dem Umstellen prüfen**, ob alle Einträge übernommen wurden. Fehlt ein
   MX-Eintrag, kommen keine Mails mehr an.
3. Bei Strato die Nameserver auf die beiden von Cloudflare genannten Server umstellen.
4. Warten, bis Cloudflare „Active“ meldet (kann einige Stunden dauern).

Prüfen:

```bash
dig +short NS deine-domain.de
# Erwartet: zwei *.ns.cloudflare.com-Server
```

### 4.2 Tunnel anlegen

In Cloudflare **Zero Trust → Networks → Tunnels → Create a tunnel** (Typ `cloudflared`).

- Name: `antwars`
- Token kopieren und auf dem Server ablegen:

```bash
sudo install -d -m 700 /etc/cloudflared
sudo sh -c 'umask 077; cat > /etc/cloudflared/token'
# Token einfügen, Enter, dann Ctrl+D
sudo chmod 600 /etc/cloudflared/token
```

Alternativ die Tunnel-ID und die JSON-Zugangsdatei nach `/etc/cloudflared/` legen
(Rechte `600`).

In der Cloudflare-Oberfläche unter **Public Hostname**:

- Subdomain: `play`
- Domain: `deine-domain.de`
- Service: `HTTP` → `127.0.0.1:8787`

Damit zeigt `https://play.deine-domain.de` auf den lokalen Server.

### 4.3 cloudflared als Dienst

```bash
sudo cloudflared service install $(sudo cat /etc/cloudflared/token)
sudo systemctl enable --now cloudflared
```

Erwartet: `systemctl status cloudflared` zeigt `active (running)`.

Prüfen von außen:

```bash
curl -s https://play.deine-domain.de/healthz
# Erwartet: ok
```

Wenn hier `502` kommt, läuft der Spielserver noch nicht (Schritt 5).

---

## 5. Spielserver als Dienst

```bash
sudo cp /opt/antwars/deploy/antwars-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now antwars-server
```

Prüfen:

```bash
systemctl status antwars-server --no-pager
# Erwartet: active (running), User antwars
ss -ltnp | grep 8787
# Erwartet: 127.0.0.1:8787, NICHT 0.0.0.0:8787
```

Logs (ohne Token und IP-Adressen):

```bash
journalctl -u antwars-server -n 50 --no-pager
```

---

## 6. Client konfigurieren

In `config.js` (oder über `SERVER_URL` in `.env` und `scripts/gen-config.sh`):

```js
window.AW_CONFIG={SUPABASE_URL:"…",SUPABASE_ANON_KEY:"…",SERVER_URL:"https://play.deine-domain.de"};
```

Danach GitHub Pages neu bauen. Ohne `SERVER_URL` zeigt der Bildschirm „Öffentliche
Spiele“ die Karte **Server nicht erreichbar**; Einzelspiel und private Lobbys laufen
unverändert weiter.

Der erlaubte Origin steht in `server/config.js` und in der Dienstdatei:

```
ALLOWED_ORIGINS=https://luistico12.github.io
```

Für eine eigene Spieldomain dort ergänzen, zum Beispiel:

```
ALLOWED_ORIGINS=https://luistico12.github.io,https://play.deine-domain.de
```

Danach `sudo systemctl restart antwars-server`.

---

## 7. Prüfen

```bash
sudo bash /opt/antwars/deploy/check.sh
```

Erwartet (Beispiel):

```
OK      Port 8787 nur auf 127.0.0.1
OK      keine unerwarteten öffentlichen Ports
OK      Dienst antwars-server läuft
INFO    Exposure level: 1.2 OK
OK      Dienst läuft als Benutzer antwars
OK      ufw ist aktiv
OK      SSH-Passwort-Login ist aus
OK      /opt/antwars gehört antwars
OK      GET /healthz antwortet ok
```

Im Spiel: Hauptmenü → **Öffentliche Spiele**. Mit zwei Konten beitreten, Startgebiet
wählen, „Bereit“ – nach 60 Sekunden Countdown startet das Match. Ein Neuladen während
des Matches: Bildschirm erneut öffnen, „Weiterspielen“ – innerhalb von 30 Sekunden
übernimmt der Spieler seine Fraktion zurück, danach ein Bot.

---

## 8. Sperrliste

Eine Datei mit je einer `sub` (Konto-ID) oder IP pro Zeile. Kommentare mit `#`.
Der Server liest sie alle 30 Sekunden neu.

```bash
sudo -u antwars sh -c 'printf "deine-konto-id\n203.0.113.7\n" > /opt/antwars/blocklist.txt'
sudo chmod 640 /opt/antwars/blocklist.txt
```

Die Konten-ID findest du im Supabase-Dashboard unter Authentication → Users.

Rate-Grenzen (im Server, unabhängig von Cloudflare): 20 Nachrichten sofort, danach
10/s; 4 Verbindungen je IP; 4 KiB je Nachricht; 10 Räume; 8 Menschen je Raum.

Cloudflare-Ratenregeln sind im kostenlosen Paket nicht für WebSockets verfügbar.
Die Begrenzung im Server ist deshalb die Hauptverteidigung; Cloudflare liefert nur
TLS und den Tunnel.

---

## 9. Update

```bash
cd /opt/antwars
sudo -u antwars git pull
cd server && sudo -u antwars npm install --omit=dev
sudo systemctl restart antwars-server
sudo bash deploy/check.sh
```

Neue Grenzwerte? `server/config.js` oder die `Environment=`-Zeilen der Dienstdatei
ändern, dann `sudo systemctl daemon-reload && sudo systemctl restart antwars-server`.

---

## 10. Rückbau

```bash
sudo systemctl disable --now antwars-server
sudo systemctl disable --now cloudflared
sudo rm /etc/systemd/system/antwars-server.service
sudo systemctl daemon-reload
# Optional: Tunnel in Cloudflare löschen, Benutzer und Verzeichnis entfernen
sudo userdel -r antwars
```

Der Tunnel lässt sich zusätzlich in Cloudflare unter Zero Trust → Tunnels löschen.
Minecraft läuft unabhängig weiter; `MemoryMax` betrifft nur `antwars-server`.

---

## 11. Grenzen

- Geprüft ist Node 24 auf der Entwicklungsmaschine; die Dienstdatei nutzt Node 22.
- Ohne Supabase-Session (reiner Gastmodus) gibt es keine öffentlichen Spiele, weil
  die Tokenprüfung ein Konto braucht. Anonyme Supabase-Konten sind gültig.
- Der Client meldet weiterhin seine Kolonie-Statistik; die Welt auf dem Server ist
  maßgeblich.
- Ein Raum endet, wenn nur noch eine Fraktion lebt oder kein Mensch mehr da ist.
