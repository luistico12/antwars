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

13. Update „Tunnel und Weltkarte“ (alles erledigt, getestet mit `node tests/worldupdate.spec.js`):
    - Tunnelansicht: Taste T (oder Raum „Tunnel“), grün = gegraben, rot = unbebaubar. Linksklick markiert, Klick halten und ziehen malt mehrere Abschnitte (`tunnelMark`/`paintAt` in `game-colony.js`). Tunnel brauchen 2 statt 5 Arbeit (2,5× schneller). Rechtsklick/T beendet.
    - Weltkarte: eigene Gebiete verschmelzen (keine Grenze zwischen Gebieten desselben Volks, Marionettenstaaten ausgenommen, `mergedTerr` in `game-core.js`). Alle Städte sichtbar, Hauptstadt wächst mit der Fläche des Reichs (`computeRegions`/`nestSize`). Kolonie nur noch für die Hauptstadt. „Behalten“ gibt Erde und Blätter (6/4 je Eroberungsstufe), Marionettenstaat nichts.
    - Kreismenü auf eigenem Gebiet (`ownRing` in `game-radial.js`): Info, Bauen, Schließen. Mitte = frei platzierbarer Verteidigungswall (max. 3 je Gebiet, +50% Grenzverteidigung im Umkreis). Bauen: Außenposten, Verteidigungslinie, Hafen, Floß, Weg.
    - Neues Modul `js/game-sea.js`: Wälle, Häfen (Küstengebiet, 3 Flöße), Wege (Linksklick halten malen, auch als Floßweg im Wasser), Wegnetze (Handel +Material/Blätter, Soldaten 2,2× schneller zwischen verbundenen Städten), Floß-Angriff und Floß-Transport zu Verbündeten (Zielkreuz an der Küste wählen). Floß kehrt nach dem Kampf zurück. Bots bauen auch Wälle, greifen aber nicht per Floß an.
14. Anpassungen: Bauen-Tab im Seitenpanel entfernt (Bauen nur noch im Kreismenü). Marionettenstaat gibt 40% der Beute (Erde, Blätter) plus Soldaten in die Hauptstadt. Wasserwege (Handel, doppelter Ertrag) brauchen Flöße: 1 Floß je 8 Wasserabschnitte.
15. Update v13 (alles erledigt, Tests: solo, radial, worldupdate, ui2, multiplayer, accounts, friends):
    - Tasten (Q/R, 1/2/3, Tab), Floß nur über Wasser, Spielzeit im Kopf, Rechtsklick halten baut mehrere, Weiterspielen nach Sieg.
    - Modi FFA (7 Gegner) und Unlimited (3,5× Karte, 5 Gegner, kein Ende), Flüsse (`carveRivers`), 15-Sekunden-Startwahl direkt auf der Karte.
    - Einstellungen (`game-settings.js`): Steuerung, Grafik (VSync via `nextFrame`, FPS-Limit, Qualität Niedrig/Mittel/Hoch/Ultra), Spiel (Standard-Truppenanteil, Kosmetik anderer ausblenden, Interface-Größe).
    - Roter Angriffsrahmen (`flashHit`), Quest-Pille und Erfolgs-Toasts im Spiel (`qLive` in ui-boot), Inventar (`S.inventory`, Menüknopf), Spieler des Tages (`#potd`, `AW.potd`, View `player_of_day` in schema.sql).
    - News v12 und v13 in `DEFAULT_NEWS` und schema.sql. Regel in CLAUDE.md: nach jedem Update einen News-Release.
## Offen (neu)
- Unlimited: Kolonie doppelt so breit/tief (`setColonyDims(2)` in startGame, 80×56 Zellen). Noch größer wäre möglich, Hintergrund-Rendering wird dann teurer.
- „Kosmetik anderer ausblenden“ wirkt erst, wenn Kosmetik anderer Spieler gerendert/synchronisiert wird (`cosmVisible`).
- schema.sql erneut im Supabase-SQL-Editor ausführen (View `player_of_day`, News v12/v13).
- Mehrspieler synchronisiert Wälle, Häfen, Wege und Flöße noch nicht (nur Host-Welt, Gäste sehen sie nicht).
- Bots nutzen keine Häfen/Flöße/Wege.

## Offen
- Im Supabase-Dashboard: Authentication → Sign In / Providers → „Allow anonymous sign-ins“ aktivieren (sonst Fallback auf lokales Konto ohne Sync).
- Mehrspieler: Gäste können noch keine Bündnisse, Spenden oder Befehlsposten/Verteidigungslinien; Host-Niederlage beendet die Partie für alle; nur lokal (BroadcastChannel) getestet, nicht über echtes Supabase Realtime.
- `supabase/schema.sql` im Supabase-SQL-Editor ausführen (nötig für Server).
- Supabase live testen (nur mit echten Zugangsdaten möglich).
- Lobby-Beitritt/-Erstellen zeigen jetzt die echte Ursache („Server noch nicht aktualisiert“), Code wird kleingeschrieben gesucht. Freunde/Lobbys gehen nur, wenn `supabase/schema.sql` komplett im Supabase-SQL-Editor ausgeführt wurde.
- Login: Google entfernt, GitHub-Anmeldung statt dessen (Discord bleibt). Offen: GitHub-Provider in Supabase einrichten (OAuth App, Callback-URL aus Supabase eintragen).
- Auth-Callback: kein await auf Supabase im onAuthStateChange (SDK-Deadlock); unerwartetes SIGNED_OUT zeigt Toast 'Abgemeldet (Sitzung ungültig)'. Ursache für sofortige Abmeldung nach Login noch nicht bestätigt.
