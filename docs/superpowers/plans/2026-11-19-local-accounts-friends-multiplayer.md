# Lokale Konten, Freunde, Host-Multiplayer – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, one session). Steps use checkbox syntax.

**Goal:** Spielen ohne Anmeldezwang (anonyme Supabase-Konten mit `Name#1234`), Freundesliste, Host-basierter Multiplayer auf gemeinsamer Weltkarte.

**Architecture:** Statische Vanilla-JS-Seite. `AW`-Backend bekommt anonyme Anmeldung, `tag` und Freundes-API (Remote + Local-Fallback mit gleicher Schnittstelle). Multiplayer: Host simuliert die Welt weiter wie im Einzelspiel, sendet Schnappschüsse über den bestehenden Lobby-Kanal; Gäste senden Befehle.

**Tech Stack:** Vanilla JS, Supabase (Auth anonym, Postgres/RLS, Realtime), Playwright zum Testen, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-19-local-accounts-friends-multiplayer-design.md`

## Global Constraints
- Kein Build-Schritt, klassische Skripte, Reihenfolge in `index.html` beachten.
- Texte deutsch via `t('…')`, Englisch in `js/i18n-en.js`.
- Kein eigenes Passwort-Handling, RLS für alle neuen Tabellen, Fehlermeldungen allgemein.
- Spiel-DOM-IDs nicht umbenennen. Ohne `config.js` bleibt der Offline-Gastmodus funktionsfähig.
- Tag = 4 Ziffern `0001`–`9999`, Paar `(username, tag)` einmalig.

## Review Focus
- Zwei Spieler mit gleichem Namen bekommen verschiedene Tags; Name mit `#` oder Leerzeichen am Rand wird bereinigt.
- Freundschaftsanfrage an sich selbst oder an unbekannte `Name#Tag` gibt dieselbe allgemeine Antwort.
- Anonyme Anmeldung nicht verfügbar (Dashboard nicht aktiviert) → Fallback auf lokalen Modus statt weißem Bildschirm.
- Host verlässt die Lobby/Partie → Gäste bekommen Hinweis und landen im Hauptmenü.
- Gast sendet unsinnige Befehle (fremdes Gebiet, zu viele Truppen) → Host ignoriert sie.

---

### Task 1: Anonyme Konten und Name#Tag
**Files:** Modify `supabase/schema.sql`, `js/backend.js`, `js/ui-core.js`, `js/ui-boot.js`, `js/ui-screens.js` (Profil), `js/i18n-en.js`; Test `tests/accounts.spec.js`
**Interfaces:** Produces `AW.tag` (string `'0001'`), `AW.fullName` (`'Name#0001'`), `AW.setName(name)`; `profiles.tag char(4)`, RPC `set_username(n text)`.
- [ ] Test (Local-Backend, Playwright): erster Start ohne config → Hauptmenü ohne Login, `AW.fullName` passt auf `/^.{2,20}#\d{4}$/`; Namensänderung vergibt neuen Tag; Name mit `#` wird bereinigt.
- [ ] Schema: Spalte `tag`, `unique(username,tag)`, Trigger/RPC vergibt Zufalls-Tag mit Wiederholung bei Kollision.
- [ ] `Remote.init`: ohne Session `signInAnonymously()`; Fehler → `API=Local`. `loginRequired()` liefert `false`; Login-Dialog nur noch optional (Konto sichern per `updateUser`/OAuth-Link).
- [ ] `Local`: Tag-Logik gleich, `AW.setName`.
- [ ] Profil-Screen: Name ändern, `#Tag` anzeigen. Kopfzeile zeigt Name#Tag.
- [ ] Test grün, Commit.

### Task 2: Freunde
**Files:** Modify `supabase/schema.sql`, `js/backend.js`, `js/ui-screens.js`, `js/ui-boot.js` (Rail-Button), `js/icons.js`, `js/i18n-en.js`; Test `tests/friends.spec.js`
**Interfaces:** Produces `AW.friends() → {list:[{id,name,tag,online?}], incoming:[…], outgoing:[…]}`, `AW.friendRequest(nameTag)`, `AW.friendRespond(id,accept)`, `AW.friendRemove(id)`.
- [ ] Test (Local-Backend mit zweitem simulierten Konto): Anfrage per `Name#1234`, annehmen, entfernen; unbekanntes Ziel und Selbstanfrage → gleiche Meldung.
- [ ] Schema: `friendships` + RLS, RPCs `friend_request(n,tg)`, `friend_respond(fid,acc)`, `friend_remove(fid)`, Liste über security-definer-Funktion `my_friends()`.
- [ ] Backend Remote + Local, Screen `S.friends` (Liste, Anfragen, Hinzufügen), Rail-Button.
- [ ] Test grün, Commit.

### Task 3: Net-Adapter und Host-Schnappschüsse
**Files:** Create `js/net.js` (vor `ui-core.js` laden); Modify `js/ui-screens.js` (Lobby-Start), `js/game-world.js`, `js/game-ui.js`; Test `tests/multiplayer.spec.js`
**Interfaces:** `Net.host(ch)`, `Net.guest(ch)`, `Net.snapshot() → obj`, `Net.apply(obj)`, `Net.cmd(c)`; Befehle `{t:'launch',from,to,n}`, `{t:'ally',fid}`, `{t:'donate',…}`.
- [ ] Test (zwei Seiten, lokaler BroadcastChannel): Host startet, Gast sieht Gebietsbesitz des Hosts nach Schnappschuss; Gast-Angriffsbefehl ändert Host-Welt; ungültiger Befehl wird ignoriert; Host schließt → Gast landet im Menü mit Hinweis.
- [ ] Spielerstämme: Lobby-Spieler werden Fraktionen (statt Bots 1–3, Rest Bots); Gast-ID wird beim Schnappschuss so umgedreht, dass er sich selbst als `F[0]` sieht.
- [ ] Gast: Welt-Update (`worldTick`) aus, Schnappschuss ~2×/s anwenden, Aktionen als Befehle senden.
- [ ] Host: Befehle validieren (Besitzer, Truppen, Nachbarschaft) und über bestehende Funktionen (`launch`, `proposeAlliance`) ausführen.
- [ ] Test grün, Commit.

### Task 4: Veröffentlichen
- [ ] `PROGRESS.md` und `README.md` aktualisieren (Schritte für Nutzer: `schema.sql` ausführen, „Anonymous sign-ins“ aktivieren).
- [ ] Alle Tests, Konsole ohne `pageerror`, Push nach `main`; Pages-Workflow prüfen.
