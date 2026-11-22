# Öffentliche Spiele auf dem eigenen Server – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öffentliche Matches laufen auf dem Ubuntu-Heimserver des Nutzers (Weltsimulation in Node, Server entscheidet), erreichbar über einen Cloudflare Tunnel, mit neuem Bildschirm „Öffentliche Spiele“ und deutscher Einrichtungsanleitung.

**Architecture:** Die bestehenden Weltdateien (`js/game-core.js`, `js/game-world.js`, `js/game-sea.js`) laufen **unverändert aus derselben Quelle** je Match in einem eigenen `vm`-Kontext in Node (mit Attrappen für Anzeige und Kolonie). Faction 0 ist auf dem Server ein toter Platzhalter, alle Menschen sind Gäste mit Fraktion 1…n. Das vorhandene Nachrichtenformat aus `js/net.js` (`ready`, `ack`, `nack`, `init`, `snap`, `cmd`, `end`) bleibt, nur der Transport wird ein WebSocket. Der Client nutzt seinen vorhandenen Gast-Pfad (`NET.V()` tauscht die eigene Fraktion mit dem toten Platzhalter 0).

**Tech Stack:** Node 22 (CommonJS, `node:test`), `ws` (einzige Abhängigkeit), `node:crypto` für die Tokenprüfung, vorhandene Playwright-Tests, systemd, `cloudflared`, `ufw`, `fail2ban`.

**Spec:** `docs/superpowers/specs/2026-11-22-public-matches-server-design.md`

## Global Constraints

- Server hört nur auf `127.0.0.1:8787`; im Router wird kein Port geöffnet; Heim-IP bleibt verborgen.
- Erlaubter Origin: `https://luistico12.github.io` (Liste in `server/config.js`, später um die Spieldomain erweiterbar).
- Maximale Nachrichtengröße 4096 Bytes; jede Nachricht wird gegen ein Schema geprüft.
- Grenzen: 10 Räume, 8 Menschen je Raum; Matchstart ab 2 Menschen mit 60 s Countdown; Schonfrist bei Abbruch 30 s; kein spätes Beitreten.
- Modi und Botzahlen wie im Einzelspiel (`MODES` in `js/game-core.js`).
- Auf dem Spielserver liegt kein Geheimnis. Tokens werden über die öffentlichen Schlüssel des Supabase-Projekts geprüft (Projekt nutzt ES256, JWKS-URL `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, geprüft am 2026-11-22). Anonyme Konten sind gültig.
- Keine Token oder IP-Adressen dauerhaft protokollieren (DSGVO).
- Prozess: eigener Benutzer ohne Login-Shell, systemd-gehärtet, `MemoryMax` aus dem Lasttest (Richtwert 1 GB), Minecraft darf nie verdrängt werden.
- Browser: kein Build-Schritt, klassische Skripte, keine externen Fonts oder Bilder. Texte laufen durch `t('…')` (Deutsch in Code, Englisch in `js/i18n-en.js`).
- Jedes Update bekommt einen News-Release (`DEFAULT_NEWS` in `js/backend.js` plus `INSERT` in `supabase/schema.sql`) und einen Eintrag in `PROGRESS.md`.
- Alle bestehenden Tests in `tests/` (`node tests/<name>.spec.js`) bleiben grün; Einzelspiel und bisheriges Host-Prinzip ändern ihr Verhalten nicht.
- Schlüssel nur aus `.env`/Secrets, nie ins Repo.

## Review Focus

Diese Fälle nennt der Entwurf nicht ausdrücklich, sie treffen aber reale Spieler. Jeder hat einen Test in der genannten Aufgabe.

1. Binäre, kaputte oder zu große Frames und Nicht-Objekte als JSON: Verbindung wird geschlossen, der Server läuft weiter (Task 6).
2. Abgelaufenes Token oder Token eines anderen Supabase-Projekts: abgelehnt (Task 5).
3. Dasselbe Konto in zwei Tabs: zweite Verbindung wird abgelehnt, die erste bleibt (Task 6).
4. Neuladen mitten im Countdown oder Match: Spieler übernimmt innerhalb von 30 s seine Fraktion zurück, danach Bot (Task 4).
5. Feindliche Befehle (`n` als `NaN`, negativ, riesig, Gebiets-IDs als Text oder außerhalb, nicht benachbart, fremdes Gebiet, `tr`-Dauerfeuer): ignoriert ohne Absturz (Task 4).
6. Server nicht erreichbar oder bricht mitten im Match ab: Bildschirm meldet es, Spiel stürzt nicht ab, Einzelspiel und private Lobbys laufen weiter (Task 10).

## Dateien

- `server/` neu: `package.json`, `config.js`, `protocol.js` (Schema der Nachrichten), `room.js` (Raumzustand), `rooms.js` (Raumverwaltung), `auth.js` (Tokenprüfung), `limits.js` (Ratenbegrenzung), `index.js` (HTTP und WebSocket), `sim/world-vm.js`, `sim/stubs.js`, `test/*.test.js`.
- `js/net-ws.js` neu (WebSocket-Transport), `js/net.js` (kleine Anpassungen), `js/ui-screens.js` und `js/ui-boot.js` (Bildschirm und Menüeintrag), `js/game-world.js` (Teilung von `startGame`), `scripts/gen-config.sh`, `index.html` (Skript einbinden).
- `deploy/` neu: `harden.sh`, `check.sh`, `antwars-server.service`, `cloudflared-config.yml`, `ANLEITUNG-SERVER.md`.
- `tests/` neu: `golden-world.spec.js`, `equiv-world.spec.js`, `public-match.spec.js`, `helpers/prng.js`, `golden/world-seed1.json`.

---

### Task 1: Goldenes Weltprotokoll (sichert das Einzelspiel ab)

**Files:**
- Create: `tests/helpers/prng.js`, `tests/golden-world.spec.js`, `tests/golden/world-seed1.json`

**Interfaces:**
- Produces: `seeded(seed: number) => () => number`, derselbe Zufallsgenerator wie in `tests/worldupdate.spec.js` Zeile 7, damit Browser und Server ihn teilen. `initScript(seed)` als String für `addInitScript` ist nicht nötig, nutze `seeded.toString()`.

- [ ] **Step 1:** `tests/helpers/prng.js` schreiben und `tests/worldupdate.spec.js` darauf umstellen. `node tests/worldupdate.spec.js` muss weiter grün sein.
- [ ] **Step 2:** `tests/golden-world.spec.js` schreiben (Start der Seite wie in `tests/worldupdate.spec.js`). Ablauf im Seitenkontext mit `SEED=1`: `newMap(1)`, `setupStart` = erstes Gebiet mit `terrain===SP[setupSp].terr`, `startGame()`, dann 1200× `updateWorld(0.1)`. Bei Schritt 100 und 400 `launch(T[cap], T[ersterNachbar], Math.floor(T[cap].troops)-1, 0)`. Erfasse `JSON.stringify(NET.snap())` bei Schritt 300, 600 und 1200. Assertion: die drei Texte sind gleich den gespeicherten aus `tests/golden/world-seed1.json`. Mit `GOLDEN=update` schreibt der Test die Datei neu.
- [ ] **Step 3:** Auf dem **unveränderten** Code `GOLDEN=update node tests/golden-world.spec.js` laufen lassen, dann ohne Variable. Erwartung: PASS. Zweimal ausführen: beide Läufe gleich (sonst ist die Zufallsfolge nicht fest).
- [ ] **Step 4:** Commit `test: goldenes Weltprotokoll für das Einzelspiel`.

---

### Task 2: `initWorld` herausziehen und Server-Simulationskontext

**Files:**
- Modify: `js/game-world.js:40-63` (`startGame`)
- Create: `server/package.json` (einzige Abhängigkeit `ws`; Skript `"test": "node --test test/"`), `server/sim/world-vm.js`, `server/sim/stubs.js`, `server/test/world-vm.test.js`

**Interfaces:**
- Produces in `js/game-world.js`: `initWorld({hostStart: number|null, humans: Array<{pid:string,fid:number,name:string,species:string,start:number,c:object|null}>}) => void`. Setzt Gebiete, Fraktionen, Bots, Märsche zurück wie der bisherige Weltteil von `startGame()`. Bei `hostStart===null` ist `F[0]` ein toter Platzhalter `{id:0,isPlayer:true,alive:false,capital:-1,name:'Server'}` ohne Gebiet. `startGame()` ruft `initWorld({hostStart:setupStart,humans:hum})` und führt danach unverändert den Kolonieteil aus (`newG`, `makeColony`, `syncAnts` …).
- Produces in `server/sim/world-vm.js`: `createWorld({mode:'ffa'|'unlimited', mapSeed:number, seed:number}) => World` mit
  - `World.initWorld(humans) => void` (ordnet Fraktionen 1…n in Eingabereihenfolge zu und setzt `hum[i].fid`),
  - `World.step(dt:number) => void`,
  - `World.snap() => object` (Form wie `NET.snap()`),
  - `World.initInfo() => {Fi:Array,d:string,gt:number}` (wie die Felder der bisherigen `init`-Nachricht, Platzhalter `n:'Server'`),
  - `World.launch(fid,fromId,toId,n) => boolean` und `World.troopTick(fid,tileId) => boolean` (Regeln aus `NET.hostCmd`: Besitz, Nachbarschaft, `n>=1`, `n<=floor(troops)-1`; `tr`: Eimer 12, +6/s, nur wenn `troops<100`),
  - `World.validStart(species,tileId) => boolean` (`T[id].terrain===SP[species].terr`),
  - `World.over() => {over:boolean,winnerFid:number|null}`, `World.dispose() => void`.

- [ ] **Step 1: Failing test** `server/test/world-vm.test.js`: `createWorld({mode:'ffa',mapSeed:1,seed:1})`; zwei Gültigstarts per `validStart` suchen (je ein Gebiet für `ground` und `leaf`); `initWorld` mit diesen zwei Menschen; Assertions: `snap().F[0]===0`; `snap().T[startA][0]===1` und `snap().T[startB][0]===2`; die Zahl lebender Fraktionen ist `max(humans.length+1, 1+MODES.ffa.bots)` (hier 8); nach 600× `step(0.1)` ist `snap().gt` gleich `60` (±0.1) und nichts hat geworfen; `launch(1,startA,startB,5)` liefert `false` (nicht benachbart oder zu wenige Truppen); `launch(2,startA,…)` liefert `false` (fremdes Gebiet). Zweiter Test: zwei `createWorld` mit gleichem `seed` liefern nach 300 Schritten gleiche `snap()`-Texte, mit anderem `seed` verschiedene.
- [ ] **Step 2:** `cd server && npm install && npm test`, Erwartung FAIL („createWorld is not a function“).
- [ ] **Step 3:** `initWorld` in `js/game-world.js` herauslösen. Danach `node tests/golden-world.spec.js` und `node tests/solo.spec.js` und `node tests/multiplayer.spec.js`: alle PASS (Beweis, dass das Einzelspiel und das Host-Prinzip unverändert laufen). Lebende Fraktionen insgesamt: mit `hostStart` wie bisher `max(2+humans.length, 1+MODES[modeKey].bots)`; mit `hostStart===null` (toter Platzhalter 0) `max(1+humans.length, 1+MODES[modeKey].bots)` lebende, also ein Eintrag mehr in `F`.
- [ ] **Step 4:** `server/sim/world-vm.js` implementieren: je `createWorld` ein `vm.createContext`, darin nacheinander `server/sim/stubs.js`, dann die drei Dateien aus `js/` laden (Pfad relativ zum Repo, nicht kopieren). Das `Math` des Kontexts erhält `Math.random = seeded(seed)` (Datei `tests/helpers/prng.js` bleibt die einzige Quelle; Server lädt sie über `require('../../tests/helpers/prng')`). `modeKey` und `newMap(mapSeed)` im Kontext setzen. Die Attrappen in `stubs.js` entstehen schrittweise: Test laufen lassen, jede `ReferenceError` mit der kleinsten harmlosen Attrappe beheben (`document`/`$`/`makeCanvas` mit Leer-Canvas, `toast`, `flashHit`, `askConquest`, `renderColSwitch`, `openColony`, `makeColony`, `newG`, `G={upg:{}}`, `pwMul=()=>1`, `collectItem`, `endGame` merkt sich Sieger statt UI zu öffnen). Einzelne Attrappen dürfen nichts über Spielregeln entscheiden.
- [ ] **Step 5:** `npm test` PASS; Commit `feat(server): Weltsimulation im vm-Kontext, initWorld getrennt`.

---

### Task 3: Gleichwertigkeitstest Browser ↔ Server

**Files:**
- Create: `server/test/emit-scenario.js`, `tests/equiv-world.spec.js`

**Interfaces:**
- Consumes: `createWorld` (Task 2), `initWorld` im Browser (Task 2), `seeded` (Task 1).
- Produces: `node server/test/emit-scenario.js` schreibt auf stdout ein JSON `{s100:string,s600:string}` mit den `snap()`-Texten nach 100 und 600 Schritten.

- [ ] **Step 1: Failing test** `tests/equiv-world.spec.js`: ruft `emit-scenario.js` per `child_process.execFileSync` auf. Im Browser dasselbe Szenario: `newMap(1)`; Zufallsfolge **unmittelbar vor** `initWorld` mit `seeded(1)` neu setzen; `initWorld({hostStart:null,humans:[A,B]})` mit denselben zwei Menschen wie `emit-scenario.js` (Gültigstarts deterministisch: jeweils das erste Gebiet des passenden Geländes); dann `updateWorld(0.1)` mal 600; bei Schritt 50 `launch(T[a],T[nachbar],n,1)` mit festem `n`. Assertion: `JSON.stringify(NET.snap())` gleich `s100` und gleich `s600`.
- [ ] **Step 2:** Test laufen lassen. Erwartung: FAIL oder PASS. Bei FAIL liegt die Abweichung in einer Attrappe, die Spielregeln beeinflusst, oder im Zufallsverbrauch zwischen `initWorld` und Schritt 1. Ursache beheben, nicht das Szenario aufweichen.
- [ ] **Step 3:** PASS erreichen. Der Test bleibt dauerhaft in `tests/` und beweist „eine Quelle“.
- [ ] **Step 4:** Commit `test: Browser und Server liefern denselben Weltverlauf`.

---

### Task 4: Nachrichtenschema und Raumlogik

**Files:**
- Create: `server/protocol.js`, `server/room.js`, `server/config.js`, `server/test/room.test.js`

**Interfaces:**
- Produces `server/config.js`: `HOST, PORT(8787), ALLOWED_ORIGINS, MAX_MSG_BYTES(4096), MAX_ROOMS(10), MAX_HUMANS(8), MIN_HUMANS(2), COUNTDOWN_S(60), GRACE_S(30), SNAP_MS(500), STEP_DT(0.1), MSG_BURST(20), MSG_PER_S(10), CONN_PER_IP(4), IDLE_MS(60000)` (Startwerte, der Lasttest in Task 7 darf sie ändern).
- Produces `server/protocol.js`: `parseClientMsg(raw: string|Buffer) => {ok:true,msg:object}|{ok:false}`. Erlaubte `msg.t`: `auth`(`token:string`, `pid:/^[a-z0-9]{4,8}$/`), `join`(`mode:'ffa'|'unlimited'`), `leave`, `ready`(`name`, `sp`, `start:int`, `c:object|null`), `cmd`(`k:'launch'` mit `from,to,n` oder `k:'tr'` mit `tile`). Alles andere, Nicht-Objekte, zusätzliche Felder in falschen Typen, Strings über 64 Zeichen: `ok:false`.
- Produces `server/room.js`: `class Room { constructor({id, mode, send:(sub,msg)=>void, onEmpty:()=>void, seed:number}); join(sub, pid, name) => 'ok'|'full'|'started'; leave(sub) => void; ready(sub, {name,sp,start,c}) => void; cmd(sub, c) => void; tick(dtSeconds:number) => void; listing() => {id,mode,state,humans,max,countdown}; state: 'waiting'|'countdown'|'running'|'ended' }`. Sendet an Clients die Nachrichten `ack`, `nack{why}`, `room{state,players,countdown}`, `init{...World.initInfo(), fids:{[pid]:fid}, hp:null, d}`, `snap{...World.snap()}` alle `SNAP_MS`, `end{winner}`.
- Verhalten: ≥`MIN_HUMANS` bereite Menschen starten den Countdown; sinkt die Zahl darunter, zurück zu `waiting`; Raum identifiziert Menschen über `sub`, nicht über `pid`; abwesender Mensch behält 30 s seine Fraktion, danach `f.human=false;f.timer=3` (Bot), Rückkehr mit gleichem `sub` innerhalb der Frist übernimmt die Fraktion samt neuem `pid` und bekommt `init` erneut; keine Menschen mehr → `onEmpty()` und `World.dispose()`; `ended`, wenn kein lebender Mensch mehr da ist, im Modus `ffa` zusätzlich, wenn nur noch eine lebende Fraktion übrig ist (`unlimited` hat wie im Einzelspiel kein Siegende).

- [ ] **Step 1: Failing tests** `server/test/room.test.js` (Zeit ausschließlich über `tick`, keine echten Timer):
  - `countdown startet erst ab 2 bereiten Menschen und fällt zurück, wenn einer geht`
  - `init geht an alle, jeder sieht fids für alle pids und hp null`
  - `Abbruch: nach 29 s Rückkehr mit neuem pid bekommt dieselbe Fraktion, nach 31 s ist sie Bot`
  - `feindliche Befehle werden ignoriert und werfen nicht`: `launch` mit `n` aus `[NaN,-1,0,1.5,1e9,'5',null]`, `from/to` aus `[-1,99999,'a',null,2.5]`, nicht benachbart, fremdes Gebiet, Befehl vor Matchstart, Befehl von unbekanntem `sub`
  - `tr-Dauerfeuer: 100 Befehle in einer Sekunde erhöhen die Truppen um höchstens 12+6`
  - `leerer Raum ruft onEmpty einmal und danach keine Timer mehr` (zählt `tick`-Aufrufe der Welt)
  - `parseClientMsg lehnt Nicht-Objekte, Arrays, unbekannte t, zu lange Strings, Buffer mit Binärmüll ab` (Test in `server/test/protocol.test.js`)
- [ ] **Step 2:** `npm test` FAIL.
- [ ] **Step 3:** `server/protocol.js`, `server/config.js`, `server/room.js` implementieren; Befehlsprüfung benutzt `World.launch` und `World.troopTick` (Task 2), keine zweite Kopie der Regeln.
- [ ] **Step 4:** `npm test` PASS. Commit `feat(server): Nachrichtenschema und Raumlogik`.

---

### Task 5: Tokenprüfung

**Files:**
- Create: `server/auth.js`, `server/test/auth.test.js`

**Interfaces:**
- Produces: `createVerifier({getKeys: () => Promise<Array<JWK>>, supabaseUrl: string, now?: () => number}) => (token: string) => Promise<{sub:string, anon:boolean}>`. Nur `node:crypto`, keine Bibliothek: Header `alg` muss genau `ES256` sein, Schlüssel über `kid` aus `getKeys()` (`crypto.createPublicKey({key:jwk,format:'jwk'})`), Signatur mit `crypto.verify('sha256', data, {key, dsaEncoding:'ieee-p1363'}, sig)`. Geprüft werden Signatur, `exp` (und `nbf`, falls gesetzt), `iss === supabaseUrl+'/auth/v1'`, `aud === 'authenticated'`, `sub` nicht leer. Wirft bei jedem Fehler `Error('auth')` ohne Token im Text. Zusätzlich `jwksFromUrl(url:string) => () => Promise<Array<JWK>>` mit Zwischenspeicher (10 min) und höchstens einem Neuladen pro Minute bei unbekannter `kid`.

- [ ] **Step 1: Failing tests** mit lokalem Schlüsselpaar (`crypto.generateKeyPairSync('ec',{namedCurve:'P-256'})`, Token selbst signiert, `getKeys` liefert den öffentlichen JWK): `gültiges Token ergibt sub und anon`, `abgelaufenes Token wird abgelehnt`, `falscher iss (anderes Projekt) wird abgelehnt`, `falsche aud wird abgelehnt`, `fremder Schlüssel wird abgelehnt`, `alg none und alg HS256 werden abgelehnt`, `Fehlermeldung enthält das Token nicht`.
- [ ] **Step 2:** FAIL; **Step 3:** implementieren; **Step 4:** `npm test` PASS.
- [ ] **Step 5:** Commit `feat(server): Supabase-Token über öffentliche Schlüssel prüfen`.

---

### Task 6: HTTP- und WebSocket-Server mit Begrenzungen

**Files:**
- Create: `server/limits.js`, `server/rooms.js`, `server/index.js`, `server/test/server.test.js`

**Interfaces:**
- Produces `server/limits.js`: `class TokenBucket { constructor(burst:number, perSecond:number, now:()=>number); take() => boolean }`, `class IpCounter { open(ip) => boolean; close(ip) => void }` (Obergrenze `CONN_PER_IP`).
- Produces `server/index.js`: `start({port, verify, now, blocklistPath, config?:Partial<config>}) => Promise<{port:number, close:()=>Promise<void>}>` (`config` überschreibt die Werte aus `server/config.js`, damit Tests kurze Fristen nutzen; keine Umgebungsvariablen steuern Sicherheits- oder Zeitwerte). Raumverwaltung in `server/rooms.js`: `class Rooms { constructor({config,send,seedFn}); join(sub,pid,name,mode) => {room?:Room, err?:'full'|'started'}; listing() => Array; tick(dt) => void }`. Der Produktionsstart (`node server/index.js`) liest nur `PORT`, `SUPABASE_URL`, `BLOCKLIST_PATH`. Routen: `GET /healthz` → `200 ok`, `GET /matches` → JSON `[{id,mode,state,humans,max,countdown}]` (ohne `sub`, `pid` oder Namen). WebSocket: Origin muss in `ALLOWED_ORIGINS` stehen (sonst `403` beim Upgrade), erste Nachricht muss `auth` sein (Frist 5 s), `CF-Connecting-IP` zählt nur, wenn die Verbindung von `127.0.0.1` kommt, sonst die Socket-Adresse. Eine Verbindung je `sub`; zweite wird mit `err{why:'duplicate'}` abgelehnt, die erste bleibt. Sperrliste: Datei mit je einer `sub` oder IP je Zeile, wird alle 30 s neu gelesen. Leerlauf nach `IDLE_MS` schließt. Fehlermeldungen an Clients allgemein (`err{why}`), nie Details. Es wird nichts mit Token oder IP in Logs geschrieben, nur Zähler und Fehlerarten.

- [ ] **Step 1: Failing tests** (echter `ws`-Client gegen `start({port:0, verify: fake})`):
  - `falscher Origin wird beim Upgrade abgelehnt`
  - `erste Nachricht kein auth → geschlossen nach Frist` (mit eingespeister Uhr)
  - `ungültiges Token → geschlossen, Server nimmt danach neue Verbindung an`
  - `Frame über 4096 Bytes → geschlossen`; `Binärframe → geschlossen`; `Text „null“, „[]“, „123“, kaputtes JSON → geschlossen`; Server antwortet danach auf `GET /healthz`
  - `dasselbe Konto zweimal: zweite abgelehnt, erste bleibt verbunden`
  - `Flut: 200 Nachrichten in einer Sekunde → Verbindung wird geschlossen`
  - `fünfte Verbindung derselben IP wird abgelehnt`
  - `Sperrliste: gesperrte sub wird abgelehnt`
  - `GET /matches enthält keine sub, keine pid, keine Namen`
  - `11. Raum wird nicht angelegt: Beitritt liefert err{why:'full'}`
- [ ] **Step 2:** FAIL; **Step 3:** implementieren; Rasterung der Räume: pro Modus genau ein wartender Raum, weitere entstehen erst, wenn der wartende voll ist oder läuft (bis `MAX_ROOMS`); Welt-Takt über ein `setInterval(100)` je Prozess, das alle Räume mit `tick(STEP_DT)` bedient.
- [ ] **Step 4:** `npm test` PASS; Commit `feat(server): WebSocket-Server mit Begrenzungen und /matches`.

---

### Task 7: Lasttest

**Files:**
- Create: `server/test/load.js` (kein Teil von `npm test`)

- [ ] **Step 1:** Skript startet `createWorld` 10× in einem Prozess (je 8 Menschen plus Bots, Modus `unlimited` für den Ausreißerfall und `ffa` für den Normalfall), lässt 300 simulierte Sekunden laufen und gibt aus: RSS nach Start, RSS am Ende, CPU-Zeit je simulierter Sekunde. Befehl: `node server/test/load.js`.
- [ ] **Step 2:** Lauf auf der Entwicklungsmaschine, Zahlen in `deploy/ANLEITUNG-SERVER.md` (Abschnitt „Richtwerte“) und als Grundlage für `MemoryMax`. Überschreitet der Normalfall 1 GB, Ursache suchen (zum Beispiel Karten-Canvas-Attrappen) statt `MemoryMax` zu erhöhen.
- [ ] **Step 3:** Commit `test(server): Lasttest für 10 Räume`.

---

### Task 8: Einrichtungsskripte und deutsche Anleitung

**Files:**
- Create: `deploy/harden.sh`, `deploy/check.sh`, `deploy/antwars-server.service`, `deploy/cloudflared-config.yml`, `deploy/ANLEITUNG-SERVER.md`

**Interfaces:**
- `deploy/harden.sh [--dry-run]`: idempotent, braucht root, gibt vor jeder Änderung aus, was passiert. Enthält: Benutzer `antwars` (`--system --shell /usr/sbin/nologin`), Verzeichnis `/opt/antwars`, `ufw` (eingehend verbieten, SSH nur aus dem Heimnetz; das Netz fragt das Skript mit `read` ab), SSH nur mit Schlüssel (Prüfung, dass mindestens ein Schlüssel in `authorized_keys` liegt, **bevor** Passwort-Login ausgeschaltet wird), `fail2ban`, `unattended-upgrades`, Node 22 über das NodeSource-Repository.
- `deploy/antwars-server.service`: `User=antwars`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `PrivateDevices=yes`, `ProtectKernelTunables=yes`, `RestrictAddressFamilies=AF_INET AF_UNIX`, `MemoryMax=` (Wert aus Task 7), `CPUQuota=100%`, `Restart=on-failure`, `Environment=SUPABASE_URL=…` (öffentlicher Wert), kein Geheimnis.
- `deploy/check.sh`: prüft und meldet `OK`/`FEHLER` je Zeile: `ss -ltnp` zeigt Port 8787 nur auf `127.0.0.1`, kein anderer neuer Port lauscht, `systemd-analyze security antwars-server` unter einem Grenzwert, `ufw status` aktiv, SSH-Passwort-Login aus, Dienst läuft als `antwars`, `/opt/antwars` gehört nicht `root`-schreibbar für andere.
- `ANLEITUNG-SERVER.md` (Deutsch, jeder Schritt mit Befehl und erwarteter Ausgabe): Domain bei Cloudflare eintragen und Nameserver bei Strato umstellen (Hinweis auf vorhandene Mail- und Website-Einträge, die Cloudflare beim Einlesen übernimmt, vor dem Umstellen prüfen), `cloudflared` als eigener Dienst mit Tunnel-Token in Datei mit Rechten `600`, Ingress auf `http://127.0.0.1:8787`, Unteradresse `play.<domain>` (Platzhalter bis der Nutzer die Domain nennt), Cloudflare-Ratenregel für die WebSocket-Adresse (Verfügbarkeit im kostenlosen Paket beim Schreiben prüfen und notieren; fehlt sie, ist die Begrenzung im Server die Hauptverteidigung), Dienst installieren, `check.sh` ausführen, Sperrliste pflegen, Update-Ablauf, Rückbau, Hinweis auf Minecraft-Speicher.

- [ ] **Step 1:** Skripte und Dienstdatei schreiben. **Step 2:** `bash -n deploy/*.sh` und, falls installiert, `shellcheck deploy/*.sh`: ohne Befund. `systemd-analyze verify deploy/antwars-server.service` falls verfügbar. **Step 3:** `deploy/harden.sh --dry-run` in einem Wegwerf-Container ohne root-Änderungen: gibt nur Pläne aus, Rückgabewert 0. **Step 4:** Anleitung gegenlesen: jeder Befehl steht in einem Codeblock, jeder Schritt hat eine Prüfung. **Step 5:** Commit `feat(deploy): Härtung, Dienste und Anleitung`.

---

### Task 9: WebSocket-Transport im Client

**Files:**
- Create: `js/net-ws.js`
- Modify: `index.html` (vor `js/net.js` einbinden), `js/net.js` (`tick`, `begin`, Beitritt)

**Interfaces:**
- Produces: `WSNet.open(url:string, token:string) => Promise<WSChannel>`; `WSChannel = {send(m:object):void, leave():void, onclose:()=>void}`; eingehende Nachrichten gehen an `NET.onmsg(m)`. `WSChannel` sendet `auth` mit `{token, pid:PID}` als erste Nachricht. Schließt der Server mit Fehler, ruft der Kanal `onclose` und der Client meldet es per `toast`.
- Consumes: `NET.begin({ch,host:false,players})`; neues Feld `NET.server=true` in `begin`-Argument `{server:true}`; `NET.tick()` kehrt bei `this.server` sofort zurück (keine Präsenzprüfung, der Server entscheidet über Abwesenheit), `NET.send` hängt weiterhin `p:PID` an.

- [ ] **Step 1: Failing test** `tests/public-match.spec.js` (zunächst nur Teil A): startet `server/index.js` über `start({port:0, verify: fake})` aus `server/` (`child_process` oder `require`), öffnet eine Seite, ruft `WSNet.open` mit Fake-Token und prüft `ack`/`room`-Nachrichten nach `join`. FAIL.
- [ ] **Step 2:** `js/net-ws.js` und die Anpassungen in `js/net.js` schreiben. Danach `node tests/multiplayer.spec.js` (bisheriges Host-Prinzip) PASS.
- [ ] **Step 3:** Der Test startet den Server im selben Prozess über `require('../server/index.js').start({port:0, verify: fake})`. Es gibt keine Testschalter im Produktionscode. Test in `server/test/server.test.js`: der Produktionsstart (`createVerifier` mit der echten JWKS-URL) lehnt ein Token des Testausstellers ab.
- [ ] **Step 4:** Commit `feat(client): WebSocket-Transport für Server-Matches`.

---

### Task 10: Bildschirm „Öffentliche Spiele“, Konfiguration, News

**Files:**
- Modify: `js/ui-screens.js` (neuer Screen `S.publicMatches`), `js/ui-boot.js` (Menüeintrag), `js/i18n-en.js`, `scripts/gen-config.sh` (`SERVER_URL`), `config.js` (leer lassen oder `SERVER_URL:""`), `js/backend.js` (`DEFAULT_NEWS`), `supabase/schema.sql` (News-`INSERT` v19), `PROGRESS.md`, `CLAUDE.md` (Dateiliste: `server/`, `deploy/`, `js/net-ws.js`)
- Test: `tests/public-match.spec.js` (Teil B)

**Interfaces:**
- Produces: `S.publicMatches=()=>shell(t('Öffentliche Spiele'),{…},body)` mit Liste (Modus, Spieler `x/8`, Zustand `wartet`/`läuft`/`voll`, Countdown), Knopf „Beitreten“ je wartendem Raum, Aktualisierung alle 5 s über `GET <SERVER_URL>/matches`. Beitritt: `WSNet.open` mit `AW.sb.auth` Zugangstoken (anonym eingeschlossen), `NET.begin({ch,host:false,players:[],server:true})`, `ready` wie im bisherigen Gast-Pfad.
- Ist `SERVER_URL` leer oder der Server nicht erreichbar: Karte „Server nicht erreichbar“ mit Knopf „Erneut versuchen“, Einzelspiel und private Lobbys unberührt.

- [ ] **Step 1: Failing test** (Teil B in `tests/public-match.spec.js`): Menüeintrag „Öffentliche Spiele“ sichtbar; ohne `SERVER_URL` erscheint „Server nicht erreichbar“ und `pageerror` bleibt leer; mit laufendem Testserver erscheint ein wartender Raum in der Liste; Beitreten öffnet das Startgebiet-Menü (`#btnStart` zeigt „Bereit“).
- [ ] **Step 2:** Screen, Menüeintrag, Texte (Deutsch in `t('…')`, Englisch in `i18n-en.js`), Konfiguration umsetzen. News-Text v19 kurz: Titel „Öffentliche Spiele“, Inhalt in einem Satz.
- [ ] **Step 3:** `node tests/ui2.spec.js`, `node tests/solo.spec.js`, `node tests/multiplayer.spec.js` PASS.
- [ ] **Step 4:** Commit `feat: Öffentliche Spiele (Bildschirm, Konfiguration, News v19)`.

---

### Task 11: Ende-zu-Ende und Gesamtprüfung

**Files:**
- Modify: `tests/public-match.spec.js` (Teil C)

- [ ] **Step 1: Failing test** Teil C: Testserver im selben Prozess mit `start({config:{COUNTDOWN_S:2, GRACE_S:2}, …})`, zwei Seiten treten bei, wählen Startgebiet, Match startet, beide sehen `snap`-Aktualisierungen (`gtime` steigt), Seite A sendet einen Angriff, Seite B sieht die Folge im Schnappschuss, Seite A wird geschlossen: nach der Schonfrist (kurze `GRACE_S` aus der Testkonfiguration) ist ihre Fraktion Bot, Seite B spielt weiter ohne Fehler (`pageerror` leer). Danach schließt auch B: Raum verschwindet aus `/matches`.
- [ ] **Step 2:** FAIL → Lücken schließen → PASS.
- [ ] **Step 3:** Gesamtlauf: `cd server && npm test`; dann alle `node tests/*.spec.js`. Alles PASS, `git status` zeigt keine Geheimnisse (`config.js` enthält nur öffentliche Werte).
- [ ] **Step 4:** `PROGRESS.md` aktualisieren; Commit `test: Ende-zu-Ende für öffentliche Spiele`.

---

## Selbstprüfung

- **Abdeckung:** Ziele (Match überlebt Weggang: Task 4; Server entscheidet: Task 4; Bildschirm: Task 10; mehrere Matches und Speicher: Task 7; Tunnel ohne Port: Task 8; Anleitung: Task 8). Absicherung: Rechner und Prozess Task 8, Eingaben Task 6, Geheimnisse Task 5 und 8, Logs Task 6. Lebenszyklus, Schonfrist, Matchliste: Task 4 und 6. News, `PROGRESS.md`, Regressionstests: Task 10 und 11.
- **Namen:** `createWorld`, `initWorld`, `snap`, `initInfo`, `launch`, `troopTick`, `validStart`, `Room`, `parseClientMsg`, `createVerifier`, `TokenBucket`, `IpCounter`, `WSNet.open` sind in den Aufgaben, die sie erzeugen, und in denen, die sie nutzen, gleich benannt.
- **Annahme zum Eingreifen:** Falls das Supabase-Projekt später auf einen gemeinsamen Geheimschlüssel (HS256) umgestellt wird, würde die Tokenprüfung ein Geheimnis auf dem Server brauchen. Der Plan geht davon aus, dass das nicht passiert (geprüft: aktuell ES256).
