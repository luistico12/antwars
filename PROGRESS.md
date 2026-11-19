# Fortschritt (Arbeitsprotokoll)

Damit eine neue Sitzung nicht von vorn beginnt: erst diese Datei lesen, dann weitermachen.

## Erledigt
1. Logo freigestellt (`img/logo.png`, `img/icon.png`).
2. Design-System `css/ui.css` (Glas, Akzent #ff5757, weiße Linien-Icons, Werbespalte rechts/unten wird nie überlagert).
3. Module: `js/util.js`, `icons.js`, `flags.js`, `cosmetics.js` (Hüte/Flaggen im Spiel), `backend.js` (Supabase + Gastmodus), `i18n*.js`, `ui-core.js` (Header, Screen-Manager, Login, Cookie-Banner), `ui-screens.js` (Profil, Erfolge, Shop, Clan, Leaderboard, News, Sprache, Lobby, Admin, Tutorial), `ui-boot.js` (Hauptmenü, Hooks, Start), `touch.js` (Langdrücken = Rechtsklick, Pinch, Wischen).
4. Spielcode in `js/game-*.js` (Hügel mit Seitenausgängen, Hut auf Ameisen, Flagge auf Hügel).
5. `supabase/schema.sql` (RLS, RPCs, Ranglisten), `scripts/gen-config.sh`, `.github/workflows/pages.yml`, `.env.example`, `README.md`.
6. Headless-Tests (Playwright): Menüs, Screens, Spielstart, Touch-Langdrücken, Mobil-Layout ohne Fehler.

7. Gepusht nach `luistico12/antwars` (main); Pause- und Einstellungsdialog geprüft.

8. `config.js` (öffentlicher URL + publishable Key, RLS schützt) eingecheckt im `AW_CONFIG`-Format; Workflow überschreibt sie nur, wenn Secrets gesetzt sind.

9. Kein Anmeldezwang mehr: anonyme Supabase-Konten (`signInAnonymously`), Name#Tag (4 Ziffern, Paar einmalig), Namensdialog beim ersten Start, „Konto sichern“ per E-Mail/OAuth. Ohne Server oder bei Fehler: lokales Konto.
10. Freundesliste (`friendships`, RPCs `friend_request/respond/remove`, `my_friends`), Screen „Freunde“ (Anfrage per `Name#1234`).
11. Mehrspieler nach Host-Prinzip (`js/net.js`): Host simuliert die Welt, sendet 2×/s Schnappschüsse über den Lobby-Kanal; Gäste spielen ihre Kolonie lokal und senden Befehle (Angriff, Soldaten aus der Kolonie). Host-Austritt beendet die Partie; verschwundene Gäste werden zu Bots.
12. Tests in `tests/` (`node tests/<name>.spec.js`): solo, accounts, friends, multiplayer. SQL-Logik wurde gegen ein lokales Postgres geprüft (Tags, RLS, Freunde).

## Offen
- Im Supabase-Dashboard: Authentication → Sign In / Providers → „Allow anonymous sign-ins“ aktivieren (sonst Fallback auf lokales Konto ohne Sync).
- Mehrspieler: Gäste können noch keine Bündnisse, Spenden oder Befehlsposten/Verteidigungslinien; Host-Niederlage beendet die Partie für alle; nur lokal (BroadcastChannel) getestet, nicht über echtes Supabase Realtime.
- `supabase/schema.sql` im Supabase-SQL-Editor ausführen (nötig für Server).
- Supabase live testen (nur mit echten Zugangsdaten möglich).
