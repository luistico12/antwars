# Fortschritt (Arbeitsprotokoll)

Damit eine neue Sitzung nicht von vorn beginnt: erst diese Datei lesen, dann weitermachen.

## Erledigt
1. Logo freigestellt (`img/logo.png`, `img/icon.png`).
2. Design-System `css/ui.css` (Glas, Akzent #ff5757, weiße Linien-Icons, Werbespalte rechts/unten wird nie überlagert).
3. Module: `js/util.js`, `icons.js`, `flags.js`, `cosmetics.js` (Hüte/Flaggen im Spiel), `backend.js` (Supabase + Gastmodus), `i18n*.js`, `ui-core.js` (Header, Screen-Manager, Login, Cookie-Banner), `ui-screens.js` (Profil, Erfolge, Shop, Clan, Leaderboard, News, Sprache, Lobby, Admin, Tutorial), `ui-boot.js` (Hauptmenü, Hooks, Start), `touch.js` (Langdrücken = Rechtsklick, Pinch, Wischen).
4. Spielcode in `js/game-*.js` (Hügel mit Seitenausgängen, Hut auf Ameisen, Flagge auf Hügel).
5. `supabase/schema.sql` (RLS, RPCs, Ranglisten), `scripts/gen-config.sh`, `.github/workflows/pages.yml`, `.env.example`, `README.md`.
6. Headless-Tests (Playwright): Menüs, Screens, Spielstart, Touch-Langdrücken, Mobil-Layout ohne Fehler.

## Offen
- Push nach `luistico12/antwars` (Repo ist jetzt der Sitzung zugeordnet).
- Supabase live testen (nur mit echten Zugangsdaten möglich).
- Pause-/Einstellungs-/Eroberungsdialog optisch final prüfen.
