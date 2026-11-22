# Öffentliche Spiele auf dem eigenen Server – Entwurf

Stand: 2026-11-22. Status: Entwurf, noch nicht freigegeben.

## Warum

Im Mehrspieler führt heute ein Spieler (der Host) die Weltsimulation. Verlässt er die Partie, endet sie für alle (`NET.hostGone`). Für öffentliche Spiele, in die Fremde jederzeit beitreten und aus denen sie gehen, ist das ungeeignet. Der Nutzer will deshalb seinen eigenen Ubuntu-Heimserver als dauerhaften Host für **öffentliche Spiele** verwenden. Der Server muss dabei streng abgesichert sein, denn er steht im Heimnetz und teilt sich die Maschine mit einem Minecraft-Server.

## Ausgangslage (im Repo gefunden)

- Spiel: statisches HTML5-Canvas-Spiel, Vanilla JS, kein Build-Schritt, klassische Skripte teilen sich den globalen Scope. Auslieferung über GitHub Pages (HTTPS).
- Mehrspieler nach Host-Prinzip in `js/net.js`: Der Host simuliert die Welt (`updateWorld`, Bots, Märsche, Kämpfe), sendet zweimal pro Sekunde einen Schnappschuss (`snap`), Gäste senden Befehle (`cmd`: `launch`, `tr`) und melden sich mit `ready`. Der Host prüft jeden Befehl (`hostCmd`). Der Transport ist ausdrücklich austauschbar: nur `NET.ch` (send/leave) und die Aufrufe `NET.onmsg` / `NET.onPresence` müssen ersetzt werden.
- Die Kolonie (Hügel, Eier, Tunnel) simuliert jeder Spieler lokal. Nur die Weltkarte (Gebiete `T`, Fraktionen `F`, Märsche `marches`) liegt beim Host.
- Die Weltlogik steckt in `js/game-core.js` (204 Zeilen), `js/game-world.js` (421) und `js/game-sea.js` (304). Dort gibt es noch etwa 55 Zugriffe auf Anzeige, Canvas oder Meldungen (`$`, `ctx`, `toast`, `document`).
- Lobbys liegen in Supabase (`lobbies`, `find_lobby`), Anmeldung über Supabase (anonym oder Konto), Name#Tag.
- Gäste können im Mehrspieler heute keine Bündnisse schließen, nichts spenden und nichts bauen. Das bleibt zunächst so.

## Ziele

- Öffentliche Spiele laufen auf dem Server und enden nicht, wenn ein Spieler geht. Ein gegangener Spieler wird zum Bot (Verhalten wie bisher).
- Der Server entscheidet über den Weltzustand und prüft jeden Befehl (Schummeln wird schwer).
- Ein neuer Bildschirm „Öffentliche Spiele“ zeigt offene und laufende Server-Matches und erlaubt den Beitritt.
- Es laufen mehrere Matches gleichzeitig auf wenig Speicher (Ziel: etwa 10 Matches mit je bis zu 8 Menschen plus Bots in unter 1 GB).
- Der Server ist von außen nur über einen Cloudflare Tunnel erreichbar. Im Router wird kein Port geöffnet.
- Der Nutzer bekommt eine deutsche Schritt-für-Schritt-Anleitung, die er selbst per SSH nachvollziehen kann.

## Nicht-Ziele (für diese Runde)

- Bündnisse, Spenden, Bauen im Mehrspieler (wie heute für Gäste nicht möglich).
- Dauerhafte Welten, die Neustarts überleben. Matches leben im Speicher, nach einem Serverneustart gehen laufende Matches verloren.
- Server-Matches mit privaten Codes. Private Lobbys behalten das Host-Prinzip über Supabase Realtime.
- Spätes Beitreten in ein bereits gestartetes Match (siehe „Entscheidungen des Entwurfs“).
- Zuschauermodus, Wiederholungen, Ranglisten aus Server-Matches.

## Anti-Ziele (das wäre ein Fehlschlag, auch wenn es technisch läuft)

- Ein Einbruch in den Spielserver öffnet den Weg ins Heimnetz oder zum Minecraft-Server.
- Der Minecraft-Server wird durch den Spielserver verdrängt (Speicher, CPU).
- Der Einzelspieler- und der bisherige Host-Modus gehen kaputt oder verhalten sich anders.
- Geheimnisse (Schlüssel, Tunnel-Token) landen im Repo oder auf dem Spielserver, wo sie nicht gebraucht werden.
- Die Heim-IP des Nutzers wird öffentlich.

## Randbedingungen

- Heimserver: Ubuntu, 3–4 GB RAM frei (Minecraft ist gedrosselt), teilt die Maschine mit Minecraft.
- Domain liegt bei Strato. Nur die Nameserver gehen zu Cloudflare (kostenloser Tarif). Falls auf der Domain E-Mail oder eine Website bei Strato läuft, müssen deren DNS-Einträge bei Cloudflare mit übernommen werden.
- Das Spiel läuft auf HTTPS, also ist `wss://` Pflicht.
- Der Server hat keinen Zugriff von hier. Alles, was auf dem Server passiert, führt der Nutzer aus. Der Entwurf liefert Skripte und Anleitung.
- Repo-Regeln aus `CLAUDE.md`: keine externen Fonts oder Bilder (DSGVO), Texte laufen durch `t('…')` (Deutsch und Englisch), jedes Update bekommt einen News-Release (`DEFAULT_NEWS` in `backend.js` plus `INSERT` in `supabase/schema.sql`), Stand in `PROGRESS.md`, Schlüssel nur aus `.env`/Secrets.

## Ansätze, die erwogen wurden

**Erreichbarkeit**
- A) Cloudflare Tunnel, Domain bleibt bei Strato, Nameserver bei Cloudflare. **Gewählt.** Kein offener Port, Heim-IP verborgen, Zertifikat inklusive.
- B) Port-Freigabe, DynDNS, Caddy. Verworfen: legt die Heim-IP offen und macht den Server direkt angreifbar.
- C) Tailscale Funnel. Verworfen: Durchsatz nicht garantiert. Bleibt Notlösung, falls die Domain nicht umziehen soll.

**Ort der Weltsimulation**
- A) Unveränderter Spielcode in einem Headless-Browser je Match. Verworfen: 300–500 MB pro Match, ein ganzer Browser auf dem Server vergrößert die Angriffsfläche.
- B) Simulation in Node auslagern. **Gewählt.** Wenige MB pro Match, der Server entscheidet, gleiche Logik wie im Browser.
- C) Nur Relay, ein Spieler bleibt Host. Verworfen: löst das Ausgangsproblem nicht.

## Entwurf

### Teile

1. **Gemeinsame Simulation.** Die Weltlogik (Karte erzeugen, Gebiete, Bots, Märsche, Kämpfe, Flöße) läuft im Browser (Einzelspiel, bisheriger Host) und im Server aus **derselben Quelle**. Es gibt keine zweite Kopie. Zugriffe auf Anzeige und Meldungen gehen über eine kleine Schnittstelle (zum Beispiel ein Ereignis `emit('toast', …)`), die im Browser die UI bedient und im Server die Ereignisse sammelt oder verwirft. Wie die Quelle geteilt wird (UMD-Modul oder Laden der bestehenden Dateien in einem `vm`-Kontext mit Attrappen), entscheidet der Umsetzer. Bedingung: kein Build-Schritt im Browser, und die bestehenden Playwright-Tests laufen weiter grün.
2. **Spielserver** (`server/`, Node, WebSocket-Bibliothek `ws`). Hört nur auf `127.0.0.1`. Hält Räume (Matches) im Speicher. Jeder Raum führt die Simulation mit fester Schrittweite und sendet `init` und zweimal pro Sekunde `snap`. Das Nachrichtenformat bleibt wie in `net.js` (`ready`, `nack`, `ack`, `init`, `snap`, `cmd`, `end`), damit auf der Clientseite nur der Transport getauscht wird. Auf dem Server gibt es keinen Spieler mit der Kennung 0. Alle Menschen sind Gäste mit eigener Fraktions-ID.
3. **Clientseitige Anbindung.** `net.js` erhält einen WebSocket-Transport anstelle von `AW.channel`. Neuer Bildschirm „Öffentliche Spiele“ (nach der Konvention `S.name`, `openScreen`) mit Liste, Beitritt und Zustand (wartet, läuft, voll).
4. **Anmeldung am Server.** Der Client sendet als erste Nachricht das Supabase-Zugangstoken (JWT). Der Server prüft Signatur, Ablauf und Herausgeber **ohne Geheimnis**, über die öffentlichen Schlüssel des Supabase-Projekts. Ohne gültiges Token wird die Verbindung geschlossen. Name und Kosmetik kommen aus den Befehlen und werden wie bisher bereinigt (`cleanName`, `cosmClean`).
5. **Matchlebenszyklus.** Der Server hält immer ein offenes „Wartezimmer“ je Modus (FFA, Unlimited). Sobald mindestens zwei Menschen drin sind, beginnt ein Countdown (Start in 60 Sekunden, früher, wenn alle bereit sind). Die restlichen Plätze füllen Bots, wie im Einzelspiel. Das Match endet wie heute durch Sieg oder wenn alle Menschen weg sind (dann wird der Raum entfernt).
6. **Matchliste.** Der Server stellt `GET /matches` bereit (Raum, Modus, Spielerzahl, Zustand). Der Client liest die Liste von dort. Die Supabase-Tabelle `lobbies` bleibt für private Lobbys.

### Absicherung

Gilt für den Server, den Tunnel und den Rechner:

- **Rechner:** SSH nur mit Schlüssel (Passwort aus, Root-Login aus), `ufw` mit „eingehend alles verboten“ (der Tunnel braucht nur ausgehende Verbindungen; SSH nur aus dem Heimnetz), `fail2ban`, `unattended-upgrades` für Sicherheitsupdates.
- **Prozess:** eigener Benutzer ohne Rechte und ohne Login-Shell, getrennt vom Minecraft-Benutzer. systemd-Härtung (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, Zugriff nur auf das eigene Verzeichnis, minimal erlaubte Systemaufrufe). `MemoryMax` und `CPUQuota`, damit Minecraft nie verdrängt wird (Richtwert: Spielserver höchstens 1 GB, mit Reserve für Minecraft).
- **Tunnel:** `cloudflared` als eigener Dienst mit eigenem Benutzer. Der Spielserver hört nur auf `127.0.0.1`, der Tunnel ist der einzige Weg hinein. Ein Cloudflare-Ratenlimit für die WebSocket-Adresse wird eingerichtet.
- **Eingaben:** Nur Origin `https://luistico12.github.io` (und die spätere Domain des Spiels) darf Verbindungen öffnen. Maximale Nachrichtengröße (zum Beispiel 4 KB), Ratenlimit je Verbindung und je Quell-IP (über `CF-Connecting-IP`), Obergrenzen für Verbindungen, Räume und Spieler, Leerlauf-Timeout, JSON-Schema-Prüfung jeder Nachricht, jeder Befehl wird wie in `hostCmd` gegen den Weltzustand geprüft.
- **Geheimnisse:** Auf dem Spielserver liegt keines. Das Tunnel-Token liegt nur im `cloudflared`-Dienst (Datei mit Rechten 600), nicht im Repo.
- **Logs:** Rotation, keine Token oder IP-Listen dauerhaft speichern (DSGVO), nur Fehler und Zähler.

### Lieferumfang

- `server/` (Node-Server, Räume, Anmeldeprüfung, Ratenlimits)
- gemeinsame Simulation (Ort entscheidet der Umsetzer)
- `deploy/` mit `harden.sh`, systemd-Diensten, `cloudflared`-Konfiguration und `ANLEITUNG-SERVER.md` (Deutsch, jeder Schritt zum Nachvollziehen, Prüfbefehle nach jedem Schritt)
- Clientseitig: WebSocket-Transport, Bildschirm „Öffentliche Spiele“, Texte Deutsch und Englisch, Menüeintrag
- Tests: Server-Test mit mehreren simulierten Clients (Beitritt, Befehl, Bot-Übernahme, Abbruch, Fehlbedienung wie übergroße Nachrichten und falsche Tokens), Vergleichstest „Browser und Server liefern bei gleicher Zufallsfolge denselben Weltverlauf“, bestehende Playwright-Tests unverändert grün
- News-Release (v19) und `PROGRESS.md`

## Entscheidungen des Entwurfs (Vorschläge, vom Nutzer noch nicht bestätigt)

- Kein spätes Beitreten: Wer nach dem Start kommt, wartet auf das nächste Match.
- Der Server verwaltet die Matchliste selbst, statt Supabase `lobbies` mit einem Dienstschlüssel zu beschreiben (so liegt kein Geheimnis auf dem Server).
- Mindestens 2 Menschen und 60 Sekunden Countdown, bis ein Match startet.
- Obergrenze zunächst 10 gleichzeitige Matches und 8 Menschen je Match.
- Reihenfolge der Auslieferung: erst Server und Simulation lokal lauffähig und getestet, dann Anleitung und Einrichtung, zuletzt der Bildschirm im Spiel.

## Ergänzungen nach der Prüfung (meine Annahmen, zum Gegenlesen)

- **Zufall und Zeit:** Die Weltlogik nutzt `Math.random` (rund 22 Stellen in `game-world.js` und `game-sea.js`), aber weder `Date.now` noch Bildzeit. Der Server setzt wie die bestehenden Tests (`tests/worldupdate.spec.js`) einen Zufallsgenerator mit festem Startwert. Der Vergleichstest prüft, dass Browser und Server bei gleichem Startwert und gleichen Befehlen nach N Schritten denselben Schnappschuss (`snap()`) liefern. Gleichwertig reicht, bitgenau ist nicht nötig. Die Schrittweite ist die des Browsers (`updateWorld(dt)` mit festem `dt` auf dem Server).
- **Client im Server-Match:** Er nutzt den vorhandenen Gast-Pfad (nur Schnappschüsse anwenden, Welt lokal nicht simulieren, Befehle senden). Die Ansichtsvertauschung `NET.V()` wird so verallgemeinert, dass jeder Mensch sich selbst als „0“ sieht. Ob dafür ein dritter Modus neben Host und Gast nötig ist, entscheidet der Umsetzer.
- **Anmeldung:** Anonyme Supabase-Konten sind gültig (kein Anmeldezwang, wie beschlossen), vorbehaltlich der offenen Frage unten. Eine Verbindung je Konto (`sub`), eine zweite ersetzt die erste nicht, sondern wird abgelehnt. Namen müssen nicht eindeutig sein, sie dienen nur der Anzeige und werden bereinigt. Der Server hat eine Sperrliste (Konto-Kennungen und IPs), die per Datei auf dem Server gepflegt wird. Ratenlimits stützen sich auf die IP, weil anonyme Konten billig sind.
- **Server-Adresse:** `SERVER_URL` steht in `config.js` (`AW_CONFIG`), erzeugt von `scripts/gen-config.sh`. Fehlt sie oder ist der Server nicht erreichbar, zeigt der Bildschirm „Server nicht erreichbar“, und private Lobbys und Einzelspiel funktionieren unverändert. Der Client kann also vor der Domain ausgeliefert werden.
- **Cloudflare-Ratenlimit:** Das kostenlose Paket bietet eine begrenzte Zahl Ratenregeln. Der Umsetzer prüft das beim Schreiben der Anleitung. Die Ratenbegrenzung im Node-Server ist die Hauptverteidigung, die Cloudflare-Regel nur ein zusätzlicher Schutz. `CF-Connecting-IP` wird nur akzeptiert, wenn die Verbindung von `127.0.0.1` kommt.
- **Verbindungsabbruch:** 30 Sekunden Schonfrist, in der der Spieler (gleiche Konto-Kennung) wieder seine Fraktion übernehmen kann (Handy-Netz, Neuladen). Danach übernimmt ein Bot.
- **Matchstart:** Fällt die Zahl der Menschen im Countdown unter 2, geht der Raum zurück ins Warten. Kartengröße und Botzahl je Modus wie im Einzelspiel (`MODES`). Unlimited hat wie im Einzelspiel kein Ende, der Raum endet, wenn alle Menschen weg sind.
- **Speicherziel:** Richtwert, kein Abnahmekriterium. Der Umsetzer liefert einen Lasttest (10 simulierte Räume) und meldet den gemessenen Speicher. `MemoryMax` wird danach festgelegt.
- **Port und Tests:** Der Spielserver hört auf `127.0.0.1:8787`, der Tunnel zeigt darauf. Tests dürfen einen lokalen Ersatz-Aussteller für Tokens nutzen.

## Dem Umsetzer überlassen

- Wie die Simulationsquelle geteilt wird.
- Genaue Schrittweite und Grenzwerte (Ratenlimits, Timeouts).
- Aufbau des Nachrichtenschemas, solange das bestehende Format erhalten bleibt.
- Dateistruktur im Repo und Namen.

## Offen (vom Nutzer zu liefern, blockiert den Bau nicht)

- Entschieden (Nutzer, 2026-11-22): Anonyme Spieler dürfen an öffentlichen Server-Matches teilnehmen.

- Domainname und gewünschte Unteradresse für den Server (zum Beispiel `play.<domain>`). Bis dahin Platzhalter.
- Ob auf der Domain bei Strato E-Mail oder eine Website läuft (betrifft den Umzug der DNS-Einträge).
