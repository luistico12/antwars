# Antwars-Spielserver auf dem Heimserver einrichten (Ubuntu, Cloudflare Tunnel)

Diese Anleitung ist für Einsteiger geschrieben. Jeder Schritt hat den Befehl in einem Codeblock und darunter,
woran du erkennst, dass er geklappt hat (**Erwartete Ausgabe / Prüfung**). Kopiere die Befehle Zeile für Zeile.
Wo etwas nicht auf deinem Server getestet werden konnte, steht **(nicht geprüft)** dabei.

Kurzfassung der Reihenfolge: Vorbereiten (1), Dateien holen und Rechner absichern (2), Node (3), Dienst (4),
Cloudflare (5 und 6), Prüfen (7), Spiel verbinden (8), von außen testen (9).

---

## 0. Überblick und Sicherheitsmodell

**Was läuft wo**

```
Spieler (Browser)  --wss://play.DEINE-DOMAIN.de-->  Cloudflare  <--ausgehende Verbindung--  cloudflared  -->  Spielserver
                                                                  (auf deinem Server)                      127.0.0.1:8787
```

- Der **Spielserver** (Node, ein Programm, eine Bibliothek `ws`) lauscht **nur auf 127.0.0.1:8787**. Von außen oder
  aus dem Heimnetz ist er direkt nicht erreichbar.
- **cloudflared** baut selbst eine **ausgehende** Verbindung zu Cloudflare auf (Port 7844). Der Weg ins Haus führt
  nur durch diese Verbindung. **Am Router wird nichts freigegeben** (keine Port-Weiterleitung für das Spiel).
  Deine Heim-IP-Adresse wird den Spielern nicht angezeigt, das HTTPS-Zertifikat kommt von Cloudflare.
- **Minecraft** bleibt, wie es ist. Seine Port-Weiterleitung am Router bleibt bestehen, und `harden.sh` lässt
  den Minecraft-Port ausdrücklich offen (du nennst ihn dem Skript).

**Was dieser Aufbau absichert**

| Ebene | Maßnahme |
|---|---|
| Rechner | Firewall `ufw` (eingehend alles verboten, nur deine Liste offen), SSH nur mit Schlüssel, SSH nur aus dem Heimnetz, `fail2ban`, automatische Sicherheitsupdates |
| Spielserver | eigener Benutzer `antwars` ohne Login, Code nur lesbar, systemd-Härtung, Speicher- und CPU-Grenze |
| Tunnel | eigener Benutzer `cloudflared`, Token in Datei mit Modus 600 (nicht in der Dienstdatei) |
| Eingaben | Server prüft Origin, Nachrichtengröße, Raten je Verbindung und IP, Obergrenzen (im Servercode) |
| Geheimnisse | Auf dem Spielserver liegt keines. `SUPABASE_URL` ist öffentlich. Das Tunnel-Token liegt nur in `/etc/cloudflared/tunnel.env` |
| Protokolle | nur journald mit Größenlimit; der Server schreibt keine Token und keine IP-Listen, nur Zähler und Fehler |

**Was Cloudflare sieht:** Cloudflare beendet TLS und sieht daher den Datenverkehr zwischen Spielern und Server
sowie die IP-Adressen der Spieler. Das gehört in die Datenschutzerklärung des Spiels (rechtlich nicht geprüft).

**Was du brauchst:** einen Ubuntu-Server mit Internet, ein Konto bei Cloudflare (kostenlos), deine Domain
(bei Strato). Die Domain kennen wir noch nicht, deshalb steht überall der Platzhalter `play.DEINE-DOMAIN.de`.
Ersetze ihn überall durch deine Adresse.

---

## 1. Vorbereitung

**Wichtigste Regel: Halte ein zweites Terminal offen.** Alles, was SSH oder die Firewall ändert, kann dich aussperren.
Teste immer in einem zweiten Terminal, bevor du das erste schließt.

### 1.1 SSH-Schlüssel prüfen (auf dem Server, im ersten Terminal)

```bash
ls -l ~/.ssh/authorized_keys
ssh-keygen -l -f ~/.ssh/authorized_keys
```

**Erwartete Ausgabe:** Die Datei existiert, und `ssh-keygen` listet mindestens eine Zeile wie
`256 SHA256:... dein-name@rechner (ED25519)`. Fehlt die Datei oder ist die Ausgabe leer, hast du noch keinen
Schlüssel. Dann **nicht weitermachen**, sondern zuerst auf deinem PC einen Schlüssel erzeugen und installieren:

```bash
# auf deinem PC (nicht auf dem Server):
ssh-keygen -t ed25519
ssh-copy-id DEIN-BENUTZER@SERVER-ADRESSE
```

### 1.2 Anmeldung mit Schlüssel in einem zweiten Terminal testen

Auf deinem PC, in einem **zweiten** Terminal:

```bash
ssh -o PreferredAuthentications=publickey -o PasswordAuthentication=no DEIN-BENUTZER@SERVER-ADRESSE
```

**Erwartete Ausgabe:** Du bist ohne Passwortabfrage angemeldet. Erscheint `Permission denied (publickey)`,
funktioniert dein Schlüssel nicht. Dann hier stoppen und das reparieren. Lass dieses zweite Terminal angemeldet.

### 1.3 Angaben sammeln, nach denen `harden.sh` fragt

```bash
ip -4 -o route show scope link
sudo ss -ltnp
```

**Erwartete Ausgabe:** Die erste Ausgabe zeigt dein Heimnetz, z. B. `192.168.1.0/24 dev eth0 ...`. Das ist die
Angabe für „Heimnetz (CIDR)“. Die zweite Ausgabe listet alle lauschenden Programme. Suche die Zeile von Minecraft
(meist Port `25565`, Programm `java`) und notiere den Port. Notiere auch alles, was sonst von außen erreichbar sein
muss (z. B. eine Karten-Weboberfläche des Minecraft-Servers).

---

## 2. Dateien auf den Server und Rechner absichern

### 2.1 Repository holen (vorläufig in dein Home-Verzeichnis, nur um `harden.sh` zu haben)

```bash
sudo apt-get update
sudo apt-get install -y git
git clone --branch feature/public-matches-server https://github.com/luistico12/antwars.git ~/antwars-src
```

`--branch feature/public-matches-server` gilt, solange der Server-Zweig noch nicht in `main` eingebaut ist.
Danach lässt du `--branch ...` weg. Ist das Repository privat, geht der Klon so nicht: Kopiere den Ordner dann
mit `scp -r` von deinem PC nach `~/antwars-src` **(nicht geprüft)**.

**Erwartete Ausgabe:** `Cloning into ...` und am Ende kein `fatal`. Prüfung: `ls ~/antwars-src/deploy` zeigt
`harden.sh`, `check.sh`, `antwars-server.service`, `cloudflared.service`, `ANLEITUNG-SERVER.md`.

### 2.2 Trockenlauf: nur anzeigen, nichts ändern

```bash
sudo ~/antwars-src/deploy/harden.sh --dry-run
```

Das Skript zeigt, was auf dem Rechner lauscht, fragt dich (Heimnetz, Ports, Minecraft-Port), druckt den Plan
und danach jeden Befehl mit `$` davor. **Nichts wird ausgeführt.** Antworte wie später im echten Lauf:

- **Admin-Benutzer:** dein Anmeldename (nicht `root`).
- **SSH-Port:** meist `22`.
- **Heimnetz (CIDR):** aus Schritt 1.3, z. B. `192.168.1.0/24`. Nur wenn du SSH bewusst aus dem Internet erlauben willst: `ALLE`.
- **TCP-Ports, die von außen erreichbar bleiben:** mindestens der Minecraft-Port, z. B. `25565`.
- **Minecraft-Port:** z. B. `25565`.
- **UDP-Ports:** normalerweise leer. Nur eintragen, wenn Minecraft-Mods UDP brauchen (z. B. Simple Voice Chat `24454`).

**Erwartete Ausgabe:** Am Ende `TROCKENLAUF beendet. Nichts wurde geändert.` Lies den Plan genau. Steht dort
irgendein Port, den du nicht freigeben willst, oder fehlt einer, den Minecraft braucht, starte den Trockenlauf neu.

### 2.3 Echter Lauf

Das erste Terminal bleibt offen, das zweite aus Schritt 1.2 ebenfalls.

```bash
sudo ~/antwars-src/deploy/harden.sh
```

Das Skript stellt dieselben Fragen, druckt den Plan und verlangt zur Bestätigung die Eingabe von `JA-AENDERN`.
Es fragt außerdem, ob du dich mit dem Schlüssel angemeldet hast (nur dann wird der SSH-Passwort-Login abgeschaltet),
und zeigt für den Node-Schlüssel Fingerabdruck und Prüfsumme an.

Was es tut: Pakete `ufw fail2ban unattended-upgrades git curl gnupg` installieren; Benutzer `antwars` und `cloudflared`
anlegen (ohne Login); `/opt/antwars`, `/etc/antwars`, `/etc/cloudflared` anlegen; Node.js 22 einrichten;
journald auf 200 MB begrenzen; fail2ban und Sicherheitsupdates; SSH-Passwort-Login aus; Firewall `ufw` mit genau deiner Portliste.
Jede geänderte Datei wird vorher nach `/root/antwars-backup-<Datum>/` gesichert; neu angelegte Dateien stehen in
`/root/antwars-backup-<Datum>/NEU-ERSTELLT.txt`.

**Erwartete Ausgabe:** Am Ende `... Änderung(en) durchgeführt`. Danach **sofort** zwei Tests:

```bash
# im zweiten Terminal (PC): neue SSH-Verbindung öffnen
ssh DEIN-BENUTZER@SERVER-ADRESSE
```

Und Minecraft: ein Freund (oder du) verbindet sich testweise mit dem Minecraft-Server. Geht eines davon nicht,
schließe das erste Terminal **nicht**, sondern springe zu [Abschnitt 12](#12-fehlersuche).

### 2.4 Zweiter Lauf: ändert nichts

```bash
sudo ~/antwars-src/deploy/harden.sh
```

Gib dieselben Antworten (Enter übernimmt die gespeicherten Vorgaben). **Erwartete Ausgabe:**
`Nichts zu tun: alles war schon in Ordnung (idempotent).` Falls stattdessen `GEÄNDERT:` Zeilen erscheinen, sind
das meist Ufw-Regeln, die das Skript nicht sicher als vorhanden erkennen konnte (ufw setzt Regeln sowieso nur einmal)
**(nicht geprüft)**.

### 2.5 Programmdateien nach /opt/antwars

Der Server braucht das ganze Repository, denn er lädt die Spiellogik aus `js/` (dieselbe Quelle wie der Browser).

```bash
sudo git clone --branch feature/public-matches-server https://github.com/luistico12/antwars.git /opt/antwars
sudo ls -ld /opt/antwars /opt/antwars/server /opt/antwars/js
rm -rf ~/antwars-src
```

**Erwartete Ausgabe:** `drwxr-xr-x ... root root` für alle drei. Die Dateien gehören `root`: Der Dienst
darf sie lesen, aber nicht ändern.

---

## 3. Node und die Bibliothek `ws`

`harden.sh` hat Node 22 aus dem NodeSource-Repository (signierter Schlüssel, kein `curl | bash`) installiert.

```bash
node -v
npm -v
```

**Erwartete Ausgabe:** `v22.x.y` und eine npm-Version. Ist `node -v` kleiner als 22, siehe Fehlersuche.

Jetzt die einzige Abhängigkeit `ws` installieren, **als Admin mit `sudo`, nicht als Dienst-Benutzer**, damit die Dateien `root` gehören:

Im Repository liegt aktuell **keine** `package-lock.json` (zu klären: eine Lock-Datei sollte auf einem Rechner mit Zugang zur npm-Registry erzeugt und eingecheckt werden).
Deshalb:

```bash
cd /opt/antwars/server
sudo npm install --omit=dev --ignore-scripts
```

Gibt es die Lock-Datei später (Prüfung: `ls /opt/antwars/server/package-lock.json`), nimm stattdessen `sudo npm ci --omit=dev --ignore-scripts`: das installiert exakt die geprüfte Version.

**Erwartete Ausgabe:** `added 1 package` (oder ähnlich, nur `ws`). Prüfung, dass der Dienst-Benutzer sie laden kann:

```bash
sudo -u antwars node -e "require('/opt/antwars/server/node_modules/ws'); console.log('ws ok')"
```

**Erwartete Ausgabe:** `ws ok`.

---

## 4. Dienst installieren und starten

```bash
sudo cp /opt/antwars/deploy/antwars-server.service /etc/systemd/system/antwars-server.service
sudo chmod 644 /etc/systemd/system/antwars-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now antwars-server
systemctl status antwars-server --no-pager
```

**Erwartete Ausgabe:** `Active: active (running)`. Im Journal steht `server listening`:

```bash
journalctl -u antwars-server -n 20 --no-pager
```

Prüfung, dass er nur lokal lauscht und antwortet:

```bash
sudo ss -ltnp | grep 8787
curl -s http://127.0.0.1:8787/healthz; echo
curl -s http://127.0.0.1:8787/matches; echo
```

**Erwartete Ausgabe:** Die erste Zeile zeigt `127.0.0.1:8787` (nicht `0.0.0.0` und nicht `*`), dann `ok`, dann `[]`.

Was in der Dienstdatei steht und warum:

- **`User=antwars`, `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, Schutz für Kernel und cgroups:**
  der Dienst darf fast nichts außer seinem Code lesen. Er schreibt nichts auf die Platte (die Sperrliste wird nur gelesen), deshalb gibt es kein beschreibbares Verzeichnis.
- **`RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX`:** nur normale Netzwerkverbindungen. Der Server ruft die öffentlichen Schlüssel von Supabase
  (`https://hkrnduhssueuijveffof.supabase.co/auth/v1/.well-known/jwks.json`) per **ausgehendem HTTPS (443)** ab. Ausgehend ist in `ufw` erlaubt, dafür ist nichts einzustellen.
- **`MemoryDenyWriteExecute=no`:** Node (V8) übersetzt JavaScript zur Laufzeit in Maschinencode (JIT) und braucht dafür Speicher,
  der gleichzeitig beschreibbar und ausführbar ist. Mit `yes` stürzt Node beim Start ab. Die übrige Härtung bleibt.
- **`SystemCallFilter=@system-service` ohne `@privileged @resources`, `CapabilityBoundingSet=` leer:** nur gewöhnliche Systemaufrufe, keine Sonderrechte.
  `SystemCallErrorNumber=EPERM` sorgt dafür, dass ein verbotener Aufruf einen Fehler zurückgibt, statt den Prozess zu beenden.
- **`MemoryMax=384M`, `CPUQuota=100%`, `TasksMax=64`, `LimitNOFILE=4096`:** Grenzen, damit der Spielserver Minecraft nie verdrängt (siehe Abschnitt 11).
- **`LogRateLimitIntervalSec=30s`, `LogRateLimitBurst=200`:** begrenzt Meldungsfluten im Journal.

Härtungswert ansehen (kleiner ist besser, Ziel unter 5.0):

```bash
systemd-analyze security antwars-server --no-pager | tail -n 3
```

**Erwartete Ausgabe:** Eine letzte Zeile `Overall exposure level for antwars-server.service: ... OK`. Auf einem Testsystem ergab die Offline-Prüfung der Datei `1.5`.

---

## 5. Cloudflare: Domain, Tunnel, Hostname

### 5.0 Vorher unbedingt lesen: Mail und Website der Domain

Wenn du die Nameserver deiner Domain zu Cloudflare umstellst, beantwortet **Cloudflare ab dann alle DNS-Anfragen** für die
ganze Domain. Läuft bei Strato auf dieser Domain eine **Website oder E-Mail**, gehen sie kaputt, wenn die zugehörigen DNS-Einträge
bei Cloudflare fehlen. Cloudflare liest beim Hinzufügen die vorhandenen Einträge automatisch ein, aber laut Cloudflare ist das
„nicht garantiert vollständig“.

Mach also **vor** der Umstellung:

1. Bei Strato anmelden → **Domains → Domainverwaltung** → Zahnrad neben der Domain → Reiter **DNS**. Schreibe alle Einträge ab oder mache Screenshots
   (A, AAAA, CNAME wie `www`, **MX**, **TXT** für SPF, DKIM- und DMARC-Einträge).
2. Nutzt du Strato-E-Mail: Strato nennt als MX `smtpin.rzone.de` und als SPF `v=spf1 redirect=_spf.strato.com`. DKIM und alles Weitere
   musst du dann bei Cloudflare **selbst** eintragen.
3. Strato sperrt laut seiner Hilfe das Ändern der Nameserver (der NS-Eintrag erscheint „inaktiv“), solange eigene **MX-, A-, SPF-Einträge oder ein DynDNS-Konto**
   zugewiesen sind. Dann musst du diese bei Strato erst entfernen. Trage sie vorher bei Cloudflare ein.
4. Ist **DNSSEC** aktiv, schalte es bei Strato **vor** der Umstellung aus (laut Cloudflare kann die Domain sonst unerreichbar werden).
   Strato erlaubt DNSSEC nur mit den eigenen Nameservern.
5. Wähle einen ruhigen Zeitpunkt. Die Umstellung kann bis zu 24 Stunden dauern.

**Wenn dir das zu riskant ist:** Nimm eine **zweite, günstige Domain nur für das Spiel** und stelle nur diese auf Cloudflare um.
Dann ist die Hauptdomain mit Mail und Website unberührt. (Die kostenlose Cloudflare-Variante kann keine einzelne Unteradresse übernehmen,
ohne die ganze Domain zu übernehmen.) Eine weitere Notlösung ohne eigene Domain ist Tailscale Funnel, mit nicht garantiertem Durchsatz.

### 5.1 Domain bei Cloudflare hinzufügen

1. Auf <https://dash.cloudflare.com/> anmelden (Konto bei Bedarf kostenlos anlegen).
2. **Onboard a domain** (in älteren Oberflächen: **Add a site**) wählen, deine Domain eingeben, Tarif **Free** wählen.
3. Cloudflare scannt die vorhandenen DNS-Einträge. **Vergleiche** die Liste mit deiner Abschrift aus 5.0 und ergänze Fehlendes von Hand
   (Mail-Einträge wie MX, SPF, DKIM, DMARC sind in der Regel „DNS only“, graue Wolke).
4. Cloudflare nennt dir **zwei Nameserver** (z. B. `xxx.ns.cloudflare.com`). Notiere beide genau.

**Erwartete Ausgabe/Prüfung:** Auf der Übersichtsseite der Domain steht Status „Pending Nameserver Update“, und die beiden Nameserver werden angezeigt.

### 5.2 Nameserver bei Strato umstellen

1. Strato-Kundenlogin → **Domains → Domainverwaltung** → Zahnrad neben der Domain → Reiter **DNS** → **NS-Record verwalten**.
2. **Eigene Nameserver** aktivieren und die beiden Cloudflare-Nameserver eintragen. Strato verlangt laut Hilfe das Format `name1.beispiel.de.` **mit Punkt am Ende**.
3. **Einstellungen übernehmen**. (Ist Domain Guard aktiv, bestätigst du mit Zwei-Faktor.)

**Erwartete Ausgabe/Prüfung:** Nach einigen Minuten bis 24 Stunden meldet Cloudflare per E-Mail „Domain is now active“, und der Status
auf der Cloudflare-Seite wechselt auf **Active**. Auf dem Server:

```bash
getent hosts cloudflare.com >/dev/null && echo dns-ok
nslookup -type=NS DEINE-DOMAIN.de
```

Die Ausgabe von `nslookup` zeigt die Cloudflare-Nameserver. Prüfe danach, ob deine **Website und E-Mail** noch funktionieren (Testmail senden und empfangen).
Fehlt etwas, ergänze es sofort in Cloudflare unter **DNS → Records**.

### 5.3 Tunnel anlegen (Dashboard)

1. Im Cloudflare-Dashboard: **Zero Trust → Networks → Tunnels** (in der aktuellen Oberfläche heißt der Menüpunkt **Networking → Tunnels**). Beim ersten Besuch
   verlangt Zero Trust eine einmalige Einrichtung (Teamname, kostenloser Tarif). Ob dabei eine Zahlungsmethode hinterlegt werden muss, konnte nicht geprüft werden.
2. **Create a tunnel** → Typ **Cloudflared** → Name `antwars` → **Create Tunnel**.
3. Als Betriebssystem **Debian** / **Linux** wählen. Cloudflare zeigt Befehle an. Einer davon sieht aus wie
   `sudo cloudflared service install eyJhIjoi...` (sehr langer Text).
4. **FÜHRE DIESEN BEFEHL NICHT AUS.** Er würde das Token in eine für jeden lokalen Benutzer lesbare Dienstdatei schreiben.
   Kopiere nur den **langen Text nach `install`** (das Token) in die Zwischenablage und halte ihn bereit.
5. Weiter auf **Routes** (oder **Public Hostname**) → **Add route / Add a public hostname** → **Published application**:
   - Subdomain: `play`
   - Domain: deine Domain aus der Liste (sie muss schon bei Cloudflare aktiv sein)
   - Service / Service URL: `http://127.0.0.1:8787` (Typ **HTTP**, nicht HTTPS)
6. Speichern. Cloudflare legt dafür automatisch den DNS-Eintrag `play` an (erfahrungsgemäß ein CNAME auf `<Tunnel-ID>.cfargotunnel.com`; in den geprüften Seiten nicht ausdrücklich bestätigt).

WebSockets laufen bei Cloudflare auf allen Tarifen. Prüfe zur Sicherheit unter **Netzwerk (Network)** der Domain, dass **WebSockets** auf **On** steht
(die Cloudflare-Seite sagt nicht eindeutig, ob es vorab an ist).

**Erwartete Ausgabe/Prüfung:** In der Liste der Tunnels steht `antwars` zunächst als **Inactive/Down**, weil `cloudflared` noch nicht läuft. Das ist richtig.

### 5.4 cloudflared installieren (apt-Repository von Cloudflare)

Auf dem Server. Der Schlüssel wird erst heruntergeladen und angezeigt, dann installiert (kein `curl | bash`):

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL --proto '=https' --tlsv1.2 -o /tmp/cloudflare-main.gpg https://pkg.cloudflare.com/cloudflare-main.gpg
gpg --show-keys --with-fingerprint /tmp/cloudflare-main.gpg
```

Vergleiche den Fingerabdruck mit der Angabe auf <https://pkg.cloudflare.com/index.html> (Cloudflare hat den Schlüssel am 30. Oktober 2025
erneuert, ein altes Schlüsselbund passt dann nicht mehr). Wenn alles stimmt:

```bash
sudo install -m 0644 /tmp/cloudflare-main.gpg /usr/share/keyrings/cloudflare-main.gpg
rm /tmp/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
command -v cloudflared
cloudflared --version
```

**Erwartete Ausgabe:** `/usr/bin/cloudflared` und eine Version. Für die Token-Datei-Option ist laut Cloudflare mindestens `2025.4.0` nötig (wir nutzen unten
die ältere, überall funktionierende Variante mit Umgebungsdatei).

### 5.5 Token sicher ablegen (nicht in der Dienstdatei, nicht in der Befehlshistorie)

Der folgende Befehl enthält das Token **nicht**. Er fragt es unsichtbar ab (`read -s`), sodass es weder auf dem Bildschirm noch in der Historie landet.
Füge es auf Nachfrage mit Rechtsklick/Einfügen ein und drücke Enter:

```bash
sudo bash -c 'umask 077; read -rsp "Tunnel-Token einfügen (unsichtbar), dann Enter: " T; echo; printf "TUNNEL_TOKEN=%s\n" "$T" > /etc/cloudflared/tunnel.env; unset T'
sudo chown root:root /etc/cloudflared/tunnel.env
sudo chmod 600 /etc/cloudflared/tunnel.env
sudo ls -l /etc/cloudflared/tunnel.env
```

**Erwartete Ausgabe:** `-rw------- 1 root root ... /etc/cloudflared/tunnel.env`. Prüfe, dass die Datei nicht leer ist, **ohne** das Token anzuzeigen:

```bash
sudo test -s /etc/cloudflared/tunnel.env && echo "Token-Datei nicht leer"
sudo cut -c1-14 /etc/cloudflared/tunnel.env
```

**Erwartete Ausgabe:** `Token-Datei nicht leer` und `TUNNEL_TOKEN=eyJ`. (systemd liest `EnvironmentFile` als root, bevor der Dienst auf den Benutzer `cloudflared` wechselt. Deshalb reicht Modus 600.)
Lösche danach das Token aus der Zwischenablage und schließe die Dashboard-Seite mit dem Befehl, sobald du fertig bist.

### 5.6 cloudflared als Dienst starten

```bash
sudo cp /opt/antwars/deploy/cloudflared.service /etc/systemd/system/cloudflared.service
sudo chmod 644 /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
systemctl status cloudflared --no-pager
journalctl -u cloudflared -n 30 --no-pager
```

**Erwartete Ausgabe:** `active (running)`. Im Journal stehen Zeilen wie `Registered tunnel connection` (Wortlaut nicht geprüft), und im Cloudflare-Dashboard
steht der Tunnel `antwars` auf **Healthy**. Meldet das Journal `Unit ... has a bad unit file setting` oder `Failed to start`, siehe Fehlersuche.

(Eine mitgelieferte `cloudflared-config.yml` ist nur zur Ansicht. Sie wird bei einem Tunnel mit Token **nicht** benutzt, weil Ziel und Hostname im Dashboard stehen.)

---

## 6. Rate-Limit-Regel bei Cloudflare (zusätzlicher Schutz)

**Befund beim Schreiben (geprüft am 2026-11-24, laut Cloudflare-Dokumentation):** Rate-Limiting-Regeln gibt es auch im **Free**-Tarif, aber sehr eingeschränkt:
**1 Regel**, Bedingung nur über **Pfad** (und „Verified Bot“), Zählung **nur je IP**, Zeitraum **10 Sekunden**, Sperrdauer **10 Sekunden**.
Die Dokumentation sagt nicht, ob **WebSocket-Verbindungsaufbauten** mitgezählt werden. **Unklar.** Verlasse dich daher **nicht** darauf:
Die eigentliche Verteidigung sind die Grenzen im Server (max. 4 Verbindungen je IP, Nachrichtenrate je Verbindung, Größe, Origin-Prüfung, Obergrenzen).

Wenn du die Regel trotzdem anlegen willst (Cloudflare-Dashboard → deine Domain → **Security → WAF → Rate limiting rules → Create rule**, Wortlaut der Menüs nicht geprüft):

- Name: `antwars-ws`
- Wenn: **URI Path** ist gleich `/` (oder `/ws`, je nachdem, welche Adresse der Spiel-Client benutzt; siehe Schritt 8)
- Zählen nach: **IP**
- Grenze: z. B. **20 Anfragen in 10 Sekunden**
- Aktion: **Block** für 10 Sekunden

**Erwartete Ausgabe/Prüfung:** Die Regel steht in der Liste und ist aktiv. Ein Wirkungstest für WebSockets ist nicht vorgesehen.
Bei Problemen mit normalem Spielen die Regel einfach ausschalten.

---

## 7. check.sh ausführen

```bash
sudo /opt/antwars/deploy/check.sh
```

**Erwartete Ausgabe:** Pro Zeile `OK`, `HINWEIS` oder `FEHLER`, am Ende `Ergebnis: ... 0 FEHLER`, Rückgabewert 0. Das Skript liest nur und ändert nichts.
Geprüft werden: Spielserver nur auf 127.0.0.1:8787; keine unerwarteten öffentlichen Ports; beide Dienste aktiv und unter den richtigen Benutzern;
Härtungswert unter 5.0; `ufw` aktiv mit deiner Liste; SSH-Passwort-Login aus; Sicherheitsupdates und `fail2ban`; `/opt/antwars` für Gruppe und Andere nicht schreibbar;
keine Geheimnisdateien; Minecraft-Port lauscht noch; Token-Datei Modus 600.

`HINWEIS`-Zeilen sind meist harmlos (z. B. zusätzliche alte ufw-Regel). Lies sie trotzdem. Bei `FEHLER` siehe Fehlersuche.

---

## 8. Spiel mit dem Server verbinden

Das Spiel kennt die Server-Adresse über `SERVER_URL`. Trage in der `.env` des Spiels (und in den GitHub-Secrets für das Veröffentlichen) ein:

```
SERVER_URL=wss://play.DEINE-DOMAIN.de
```

`scripts/gen-config.sh` schreibt den Wert in `config.js`. **Das Auslesen von `SERVER_URL` und der Bildschirm „Öffentliche Spiele“ kommen in einer späteren Aufgabe (Task 10)**
und sind in diesem Schritt noch nicht eingebaut. Bis dahin ist nur der Server selbst prüfbar (Abschnitt 9).
Der Server akzeptiert nur Verbindungen mit dem Origin `https://luistico12.github.io`. Zieht das Spiel auf eine eigene Domain um,
muss `ALLOWED_ORIGINS` in `server/config.js` angepasst und der Dienst neu gestartet werden.

---

## 9. Test von außen

Am besten von einem Gerät **außerhalb** deines Heimnetzes (Handy mit mobilen Daten) oder, wenn du nur den Server hast, direkt dort:

```bash
curl -i https://play.DEINE-DOMAIN.de/healthz
curl -s https://play.DEINE-DOMAIN.de/matches; echo
```

**Erwartete Ausgabe:** `HTTP/2 200` und der Text `ok`; dann `[]` (leere Liste, solange niemand spielt).

WebSocket-Test (Origin wird geprüft): Ohne passenden Origin muss der Server ablehnen, mit passendem annehmen.

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Origin: https://evil.example' \
  https://play.DEINE-DOMAIN.de/
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Origin: https://luistico12.github.io' \
  https://play.DEINE-DOMAIN.de/
```

**Erwartete Ausgabe:** erst `403`, dann `101` (Verbindung geöffnet; `curl` wartet danach auf Daten und beendet sich nach 5 Sekunden, das ist normal).
Anschließend `sudo ss -ltnp` auf dem Server: es darf **kein** neuer öffentlicher Port aufgetaucht sein.

---

## 10. Betrieb

### Updates

- **System:** laufen automatisch (`unattended-upgrades`, ohne automatischen Neustart). Ab und zu `sudo apt-get update && sudo apt-get upgrade` und, wenn Ubuntu es verlangt (`/var/run/reboot-required`), zu einer ruhigen Zeit neu starten. Minecraft und der Spielserver starten nach einem Neustart von selbst (`enable`).
- **cloudflared:** kommt über apt mit (`sudo apt-get install --only-upgrade cloudflared`, dann `sudo systemctl restart cloudflared`).
- **Spielserver-Code:**

```bash
cd /opt/antwars
sudo git pull --ff-only
cd server
sudo npm install --omit=dev --ignore-scripts
sudo systemctl restart antwars-server
sudo /opt/antwars/deploy/check.sh
```

  Ein Neustart beendet laufende Matches (Spieler werden getrennt). Mach das außerhalb der Spielzeiten. Hat sich eine `.service`-Datei geändert,
  kopiere sie neu nach `/etc/systemd/system/` und führe `sudo systemctl daemon-reload` aus.

### Sperrliste pflegen

Datei `/etc/antwars/blocklist.txt`, **eine** IP-Adresse **oder** Supabase-Nutzer-ID (UUID) pro Zeile, alles ab `#` ist Kommentar, Zeilen bis 128 Zeichen.
Der Server liest sie alle 30 Sekunden neu ein, ein Neustart ist nicht nötig.

```bash
sudoedit /etc/antwars/blocklist.txt
```

Beispiel für Einträge:

```
203.0.113.7
2b7d8c1e-0000-0000-0000-000000000000   # Nutzer, der Spiele stört
```

Die Datei gehört `root:antwars` (Modus 640). Der Dienst darf lesen, nicht schreiben. Bei Spielern über Cloudflare erkennt der Server die echte IP aus `CF-Connecting-IP`.
Trage keine IP-Adressen von Unbeteiligten länger als nötig ein (Datenschutz).

### Logs ansehen (ohne personenbezogene Daten)

```bash
journalctl -u antwars-server --since "1 hour ago" --no-pager
journalctl -u cloudflared --since "1 hour ago" --no-pager
```

Der Spielserver schreibt nur `server listening`, alle 10 Minuten eine Zeile `stats {...}` mit Zählern (Verbindungen, abgewiesene, Fehler) und Fehlermeldungen **ohne** Token und IP-Adressen.
Gib Auszüge aus dem Journal weiter nur, nachdem du sie durchgesehen hast (SSH-Anmeldungen und Firewall-Meldungen anderer Dienste können IP-Adressen enthalten).
Die Firewall schreibt abgewiesene Pakete samt Quell-IP ins Systemprotokoll. Wer das nicht möchte: `sudo ufw logging off`.
Die Größe des Journals ist auf 200 MB begrenzt (`/etc/systemd/journald.conf.d/antwars.conf`).

### Neustart und Status

```bash
sudo systemctl restart antwars-server
sudo systemctl restart cloudflared
systemctl is-active antwars-server cloudflared
```

**Erwartete Ausgabe:** zweimal `active`.

### Rückbau (alles sauber entfernen)

Zuerst die Dienste, dann die Dateien. Jeder Block ist unabhängig. Prüfe vor dem Löschen, dass du wirklich alles zurücknehmen willst.

```bash
# 1. Dienste stoppen und entfernen
sudo systemctl disable --now antwars-server cloudflared
sudo rm -f /etc/systemd/system/antwars-server.service /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload

# 2. Dateien, Token und Benutzer entfernen
sudo rm -rf /opt/antwars /etc/antwars /etc/cloudflared
sudo userdel antwars
sudo userdel cloudflared

# 3. cloudflared und sein Repository entfernen
sudo apt-get purge -y cloudflared
sudo rm -f /etc/apt/sources.list.d/cloudflared.list /usr/share/keyrings/cloudflare-main.gpg
```

Danach in Cloudflare den Tunnel `antwars` und den DNS-Eintrag `play` löschen (und, wenn du Cloudflare ganz verlassen willst, bei Strato wieder die Strato-Nameserver aktivieren, nachdem du die Einträge zurückübertragen hast).

Rechner-Einstellungen zurücknehmen (Sicherungen liegen in `/root/antwars-backup-<Datum>/`, was neu angelegt wurde, steht in `NEU-ERSTELLT.txt`):

```bash
ls /root/antwars-backup-*/
cat /root/antwars-backup-*/NEU-ERSTELLT.txt

# SSH: Passwort-Login wieder erlauben
sudo rm -f /etc/ssh/sshd_config.d/00-antwars.conf
sudo systemctl reload ssh

# Firewall: ausschalten (alles wieder offen) ODER die alte Konfiguration zurückspielen
sudo ufw disable
# Zurückspielen, falls eine Sicherung von /etc/ufw existiert (DATUM einsetzen):
# sudo cp -a /root/antwars-backup-DATUM/etc/ufw/. /etc/ufw/
# sudo cp -a /root/antwars-backup-DATUM/etc/default/ufw /etc/default/ufw
# Gab es vorher keine Firewall, bleibt sie aus. Sonst:  sudo ufw enable

# Übrige Einstellungen von harden.sh
sudo rm -f /etc/fail2ban/jail.d/antwars.local /etc/systemd/journald.conf.d/antwars.conf
sudo systemctl restart fail2ban systemd-journald
```

`/etc/apt/apt.conf.d/20auto-upgrades` und Node.js (`nodesource.list`) kannst du behalten. Sie schaden nicht. Wenn du sie entfernen willst:
`sudo rm /etc/apt/apt.conf.d/20auto-upgrades` (falls vorher eine Datei gesichert wurde, spiele sie aus der Sicherung zurück) und
`sudo apt-get purge nodejs && sudo rm /etc/apt/sources.list.d/nodesource.list /etc/apt/keyrings/nodesource.gpg`.

---

## 11. Richtwerte aus dem Lasttest (`server/LASTTEST.md`)

Gemessen am 2026-11-23 auf einer Entwicklungsmaschine (2 Kerne, 2,1 GHz, Node 22) mit **10 Räumen zu je 8 Spielern**, Schritt 0,1 s, `snap` alle 500 ms:

| Messwert | ffa | unlimited |
|---|---|---|
| RAM leerer Prozess | 40 MB | 40 MB |
| RAM Spitze (10 Räume) | 95 MB | **123 MB** |
| CPU je simulierter Sekunde (alle 10 Räume) | 2,4 ms | 3,0 ms |
| `init` | 950 Byte | 1394 Byte |
| `snap` (Maximum) | 567 Byte | 998 Byte |

Folgerungen:

- Der Server braucht **unter 1 % eines CPU-Kerns** und **etwa 40 bis 125 MB** RAM. Je Raum kommen nur etwa 3 bis 7 MB dazu.
- Die Messung empfahl `MemoryMax=256M` und `CPUQuota=50%`. Der Dienst setzt bewusst **`MemoryMax=384M` und `CPUQuota=100%`**: mehr Luft für Lastspitzen und Speicherbereinigung,
  damit der Dienst nicht wegen einer kurzen Spitze beendet wird. Die Spitze bleibt trotzdem rund 3-fach unter der Grenze.
- Obergrenze im Worst Case, was Spielserver (384 MB) und `cloudflared` (256 MB) zusammen belegen dürfen: etwa 640 MB. Dein Minecraft-Server behält den Rest.
  Prüfe den Gesamtbedarf mit `free -h` und `systemctl status antwars-server` (Zeile `Memory:`), besonders wenn Minecraft knapp bemessen ist.
- Das Verhalten mit echten Internetverbindungen (Netzwerk, Cloudflare) wurde dabei nicht gemessen.

---

## 12. Fehlersuche

Erste Schritte immer: `sudo /opt/antwars/deploy/check.sh`, `systemctl status antwars-server cloudflared --no-pager`, `journalctl -u cloudflared -n 50 --no-pager`.

**Tunnel verbindet nicht / Dashboard zeigt „Down“**
- Das Journal von `cloudflared` lesen. Meldungen über das Token: Token falsch kopiert. Wiederhole 5.5 (Token neu holen: Dashboard → Tunnel `antwars` → **Configure**).
- Die Firewall verbietet nur **eingehend**. Ausgehend muss **Port 7844 (TCP und UDP)** zu Cloudflare möglich sein (`region1.v2.argotunnel.com`, `region2.v2.argotunnel.com`).
  Manche Router/Provider sperren ihn. Test: `nc -vz region1.v2.argotunnel.com 7844`.
- `Failed to start` oder `status=203/EXEC`: Der Pfad in der Dienstdatei stimmt nicht. Prüfe `command -v cloudflared`, falls nicht `/usr/bin/cloudflared`, passe `ExecStart=` an.
- Ein Fehler bei Zugriffen auf Dateien oder Netzwerk-Schnittstellen im Journal (z. B. `permission denied`, `netlink`): Die Härtung der Dienstdatei ist **nicht auf deinem System getestet**.
  Zum Eingrenzen vorübergehend `RestrictAddressFamilies=` oder `ProtectSystem=` mit `#` auskommentieren, `sudo systemctl daemon-reload`, neu starten. Melde den Befund.

**Fehler 1033 oder 502 im Browser**
- `1033`: Cloudflare erreicht keinen Tunnel. `cloudflared` läuft nicht oder ist nicht verbunden. Siehe oben.
- `502` (Bad Gateway): Tunnel steht, aber der Spielserver antwortet nicht. `systemctl status antwars-server`, `curl -s http://127.0.0.1:8787/healthz`. Im Dashboard muss der Service `http://127.0.0.1:8787` lauten (nicht `https`, nicht ein anderer Port).
- Der Dienst startet nicht: `journalctl -u antwars-server -n 50 --no-pager`. Häufig: `ws` fehlt (Schritt 3), `SUPABASE_URL` fehlt (steht in der Dienstdatei), Node älter als 22.
  Meldungen wie `EPERM` oder ein sofortiger Abbruch kurz nach dem Start deuten auf die Systemaufruf-Sperre. **(nicht auf dem Zielsystem getestet)**: Entferne probeweise in der Dienstdatei die zwei Zeilen `SystemCallFilter=...`, lade neu, starte neu.
- Fehler beim Abruf der Schlüssel von Supabase (Anmeldungen schlagen fehl, im Journal wenig Hinweise): Der Dienst braucht ausgehend HTTPS (443). Prüfe `curl -sI https://hkrnduhssueuijveffof.supabase.co/auth/v1/.well-known/jwks.json | head -1`
  (erwartet `HTTP/2 200`). Klappt das auf dem Server, aber nicht im Dienst, füge in der Dienstdatei bei `RestrictAddressFamilies=` ein `AF_NETLINK` hinzu (Namensauflösung kann das benötigen; nicht auf dem Zielsystem getestet).

**WebSocket: 403 (Origin)**
- Der Server erlaubt nur `Origin: https://luistico12.github.io`. Ruft das Spiel von einer anderen Adresse (eigene Domain, `localhost`), antwortet er mit 403. Anpassen in `server/config.js` (`ALLOWED_ORIGINS`), Dienst neu starten.
- Auch ein WebSocket-Test mit `curl` ohne passenden `Origin` liefert 403 (siehe Abschnitt 9). Das ist gewollt.
- 429: zu viele Verbindungen von derselben IP (Grenze 4). 404: falscher Pfad (erlaubt sind `/` und `/ws`).

**Minecraft-Spieler kommen nicht mehr rein (Firewall)**

Nach `harden.sh` nur Ports aus deiner Liste offen. Minecraft-Port wieder öffnen (hier `25565`, setze deinen Port ein):

```bash
sudo ufw allow 25565/tcp
sudo ufw status numbered
```

**Erwartete Ausgabe:** Eine Zeile `25565/tcp ALLOW IN Anywhere`. Tragen Mods UDP (Voice Chat, Bedrock): `sudo ufw allow 24454/udp` (Beispiel).
Dann in `/etc/antwars/harden.conf` die Liste anpassen, damit `check.sh` die Regel kennt (am einfachsten `harden.sh` erneut ausführen und den Port nennen).
Nur zum Testen kannst du die Firewall kurz ausschalten: `sudo ufw disable` (danach wieder `sudo ufw enable`). Ist Minecraft in Docker, umgeht Docker `ufw`. Das ist eine bekannte Eigenheit von Docker, `harden.sh` weist darauf hin.

**Ich komme nicht mehr per SSH rein**
- Lass ein noch offenes Terminal offen und mache im Zweifel hier die SSH-Änderung rückgängig: `sudo rm /etc/ssh/sshd_config.d/00-antwars.conf && sudo systemctl reload ssh`.
- Kommt deine Verbindung aus einem anderen Netz als dem eingetragenen: `sudo ufw allow from DEIN-NETZ/24 to any port 22 proto tcp`.
- Ist gar kein Terminal mehr offen, brauchst du Zugang direkt am Rechner (Monitor und Tastatur), dort dieselben Befehle ausführen oder `sudo ufw disable`.

**Node ist kleiner als 22 oder `apt` meldet Fehler beim Node-Repository**
- `apt-cache policy nodejs` zeigt, woher die Version stammt. Das NodeSource-Repository steht in `/etc/apt/sources.list.d/nodesource.list`. Ubuntu-eigene Pakete können eine ältere, aber höher bewertete Version liefern. Dann `sudo apt-get install -y nodejs=22.*` mit der passenden Version aus `apt-cache madison nodejs`.

**`check.sh` meldet `unattended-upgrades ... nicht eingeschaltet` oder `fail2ban nicht aktiv`**
- `harden.sh` erneut ausführen. Schlägt fail2ban dann weiter fehl: `sudo systemctl status fail2ban --no-pager`; das SSH-Protokoll kann auf neueren Ubuntu-Versionen im Journal statt in `auth.log` stehen.
  Der Standard von Ubuntu bringt dafür eine Einstellung mit **(nicht geprüft)**.

---

## Quellen / zuletzt geprüft am 2026-11-24

Diese Seiten wurden beim Schreiben abgerufen. Cloudflare ändert seine Oberfläche häufig. Weichen die Menüs ab, gilt die jeweilige Seite.

| Thema | Quelle | Befund |
|---|---|---|
| Parameter von `cloudflared tunnel run` | <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/> | `--token <TUNNEL_TOKEN>` (Umgebungsvariable `TUNNEL_TOKEN`) und **`--token-file <PATH>` (Umgebungsvariable `TUNNEL_TOKEN_FILE`), ab cloudflared 2025.4.0**. Wir nutzen `TUNNEL_TOKEN` aus einer root-eigenen `EnvironmentFile` (Modus 600), weil systemd sie als root liest. Die Token-Datei-Option würde Leserechte für den Benutzer `cloudflared` brauchen |
| apt-Repository für cloudflared | <https://pkg.cloudflare.com/index.html> | Schlüssel `https://pkg.cloudflare.com/cloudflare-main.gpg` nach `/usr/share/keyrings/cloudflare-main.gpg`; Zeile `deb [signed-by=...] https://pkg.cloudflare.com/cloudflared any main`; Schlüssel am 30.10.2025 erneuert. Lieferte die Seite keinen Fingerabdruck? Dieser wird in 5.4 angezeigt und gegen die Seite verglichen |
| Tunnel anlegen, Hostname | <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/> | Menü heute **Networking → Tunnels**; Tunnel anlegen, Installationsbefehl mit Token wird im Dashboard angezeigt; Route **Published application**: Subdomain, Domain, Service URL (z. B. `http://localhost:8000`). Domain muss schon bei Cloudflare sein. Die Linux-Befehle stehen nur im Dashboard |
| Firewall-Anforderungen des Tunnels | <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/> | Ausgehend Port **7844 TCP (http2) und UDP (quic)** zu `region1.v2.argotunnel.com` und `region2.v2.argotunnel.com`; kein eingehender Port |
| Domain hinzufügen, Nameserver | <https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/> | Free-Tarif, DNS-Scan „nicht garantiert vollständig“, Mail-Einträge (MX, SPF, DKIM, DMARC) prüfen, DNSSEC vorher beim Registrar ausschalten, Umstellung **bis zu 24 Stunden**, E-Mail bei Aktivierung |
| Nameserver bei Strato | <https://www.strato.de/faq/domains/wie-kann-ich-bei-strato-meine-dns-eintraege-verwalten/> | Domains → Domainverwaltung → Zahnrad → DNS → NS-Record verwalten → „Eigene Nameserver“ (Format mit Punkt am Ende); NS-Änderung nicht möglich, solange eigene MX/A/SPF-Einträge oder DynDNS gesetzt sind; Strato-Mail: MX `smtpin.rzone.de`; DNSSEC nur mit Strato-Nameservern; bis 24 h |
| WebSockets bei Cloudflare | <https://developers.cloudflare.com/network/websockets/> | Auf **allen Tarifen** unterstützt. Ob standardmäßig an, ist **unklar** (Seite nennt einen Schalter „On“). Idle-Timeout nicht genannt, Heartbeat empfohlen (der Server pingt selbst) |
| Rate-Limiting im Free-Tarif | <https://developers.cloudflare.com/waf/rate-limiting-rules/> | Free: 1 Regel, Pfad und Verified Bot, Zählung nur je IP, 10 s Zeitraum, 10 s Sperre. **Ob WebSocket-Aufbau gezählt wird: nicht belegt** (auch <https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/> sagt nichts dazu) |
| Node 22 (NodeSource, manuell mit Schlüsselbund) | <https://github.com/nodesource/distributions/wiki/Repository-Manual-Installation> und <https://raw.githubusercontent.com/nodesource/distributions/master/DEV_README.md> | Schlüssel `https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key` per `gpg --dearmor` nach `/etc/apt/keyrings/nodesource.gpg`; Repository `https://deb.nodesource.com/node_<N>.x`, Suite `nodistro`, Komponente `main`, `Signed-By`. NodeSource veröffentlicht für den Schlüssel **keine Prüfsumme**, `harden.sh` zeigt Fingerabdruck und SHA-256 zum Abgleich. Die Variante mit Setup-Skript (`setup_22.x`) wird nicht benutzt |

**Nicht geprüft** (konnte von hier aus nicht getestet werden, auf deinem Server gegenprüfen):

- Alle Skripte und Dienstdateien auf einem echten Ubuntu-Server. Geprüft wurde nur Syntax (`bash -n`), `systemd-analyze verify`, ein Trockenlauf von `harden.sh` und ein Lauf von `check.sh` in einer Testumgebung ohne systemd-Betrieb.
- Ob Node mit der Systemaufruf-Sperre und ohne `AF_NETLINK` auf deinem System wie erwartet läuft (siehe Fehlersuche).
- Ob `cloudflared` mit der Härtung in `cloudflared.service` (u. a. `ProtectSystem=strict`) startet.
- Ob Zero Trust beim ersten Start eine Zahlungsmethode verlangt, und der genaue Wortlaut der Cloudflare-Menüs.
- Ob die Cloudflare-Rate-Limit-Regel WebSocket-Aufbauten zählt.
- Der exakte Wortlaut von `ufw`-Ausgaben (für die Erkennung „Regel schon vorhanden“).
