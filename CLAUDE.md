# Ant Wars – Projektkontext für Claude

Lies zuerst `PROGRESS.md` (Stand, offene Punkte). Aktualisiere sie nach jedem abgeschlossenen Schritt und committe/pushe nach `main`.



## Was das Projekt ist
Statisches HTML5-Canvas-Spiel (Vanilla JS, kein Build-Schritt), Ameisenkolonie bauen und Weltkarte erobern. Veröffentlichung über GitHub Pages (`.github/workflows/pages.yml`). Antworten an den Nutzer auf Deutsch.

## Spielidee
- Pro Kolonie ein Hügel (Seitenansicht, 40×34 Raster). Arten: Termiten, Blattschneider (in Bäumen), Bodenameisen.
- Weltkarte ohne Inseln mit Gebieten, Bot-Stämme, Bündnisse, Fahndungsstufe (Heat), Eroberung als Marionettenstaat oder behalten.
- Eier schlüpfen nach 2 Min, brauchen Platz und Pilze. Tonkuhlen brauchen Wasser. Tunnel-Werkzeug, vergrabene Funde (Powerups) in der Kolonie.
- Schutzzeit am Start: leicht 2:30, normal 1:30, schwer 1:00.
- Rechtsklick (Touch: langes Drücken) auf ein Gebiet öffnet das Kreismenü: fremd = Angriff, Bündnis, Spenden, Floß; eigen = Info, Bauen, Wall.
- Eigene Gebiete verschmelzen; Kolonie (Hügel) gibt es nur für die Hauptstadt. In der Kolonie: Taste T = Tunnelansicht (Linksklick/Ziehen).

## Dateien
- `index.html`: Gerüst (Header `#top`, Spielbereich `#app`, Werbespalte `#adrail`), lädt alle Skripte in fester Reihenfolge. Klassische Skripte teilen sich den globalen Scope.
- `css/ui.css`: komplettes Design-System. Alte Variablennamen (`--soil`, `--moss` …) sind auf das neue System abgebildet.
- Spielcode: `js/game-core.js` (Karte, Hilfen), `game-colony.js` (Kolonie, Hügel/Ausgänge, `drawAnt`), `game-world.js` (Weltkarte, Kämpfe, Diplomatie, Bots), `game-ui.js` (HUD, Dock, Kamera, Eingaben, Hauptschleife), `game-radial.js`, `game-pause.js`, `game-settings.js`.
- UI/Konto: `util.js` (Speicher mit Einwilligung, `MP`-Stub), `icons.js`, `flags.js`, `cosmetics.js` (Hüte/Flaggen), `backend.js` (`AW`-API: Supabase oder lokaler Gastmodus), `i18n.js`/`i18n-en.js`, `ui-core.js` (Header, Screen-Manager `S`/`openScreen`, Login, Cookie-Banner), `ui-screens.js` (alle Screens inkl. Lobby, Admin), `ui-boot.js` (Hauptmenü, Spiel-Hooks, Start), `game-sea.js` (Wälle, Häfen, Wege, Flöße, Seeangriff), `touch.js`, `net.js` (Mehrspieler nach Host-Prinzip: `NET`, Schnappschüsse, Befehle).
- `supabase/schema.sql`: Tabellen, RLS, RPCs (`buy_item`, `claim_quest`, `report_stats`, `find_lobby`), Ranglisten-Views.
- `scripts/gen-config.sh` erzeugt `config.js` aus `.env`/Secrets (gitignored, nie einchecken).

## Konventionen
- Design: dunkles Glas, Akzent `#ff5757`, weiße Linien-Icons (`ico('name')`) nur in Menüs/Header; die farbigen Pixel-Icons im Spiel (HUD, Dock, Kreismenü) bleiben farbig, keine externen Fonts/Bilder (DSGVO). Overlays lassen Header und Werbespalte frei (`--hh`, `--adw`, `--adh`).
- Texte im Code sind Deutsch und laufen durch `t('…')`; Englisch steht in `i18n.js`/`i18n-en.js`.
- Neue Screens: `S.name=()=>shell(titel,{…},body)` plus optional `S.name.bind`, geöffnet mit `openScreen('name')`.
- Spiel-DOM-IDs (`#cv`, `#mv`, `#chips`, `#dock`, `#side`, `#toasts` …) nicht umbenennen, der Spielcode greift darauf zu.
- Statistik/Quests über `AW.report({...})`; Käufe, Quests, Ausrüsten nur über `AW.buy/claim/update`.

## Sicherheitsregeln (strikt)
Kein eigenes Passwort-Handling (nur Supabase-SDK), RLS für alles, Spiel nur mit Session wenn Supabase konfiguriert ist, Schlüssel nur aus `.env`/Secrets, Fehlermeldungen allgemein („Ungültige Zugangsdaten“), keine Info ob eine E-Mail existiert. Admin-Rechte nur per SQL vergeben.

## Testen
Tests liegen in `tests/` (`node tests/solo.spec.js`, `accounts`, `friends`, `multiplayer`). Name#Tag, Freunde und Anmeldung: siehe `backend.js` (`AW.fullName`, `AW.friends…`).
Lokal: `./scripts/gen-config.sh && python3 -m http.server 8000`. Automatisiert mit Playwright (Chromium ist vorinstalliert, `require('playwright')`), Seite per `file://…/index.html`; Konsole auf `pageerror` prüfen. Gegen echtes Supabase ist bisher nichts getestet.

## Bekannte Grenzen
Client meldet Statistik (serverseitig gedeckelt), Lobby-Chat über öffentliche Realtime-Kanäle, UI nur Deutsch/Englisch übersetzt, Werbefläche ist Platzhalter bis `img/ad.png` existiert.
