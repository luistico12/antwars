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
16. Update v14 (Weltkarten-HUD, getestet mit `node tests/hud.spec.js`):
    - Neues `js/game-hud.js`: Bestenliste, Bauleiste (Tasten 1–6, vormerken + Klick aufs Gebiet), Material/Blätter, Truppenanteil-Leiste, Spenden-Leisten (`donT`/`donM`, vom Kreismenü genutzt), Ereignisse/Team unten rechts (alle `toast`-Meldungen, im Mehrspieler Gruppen-Chat). Seitenpanel `#side` ist im Spiel ausgeblendet (DOM bleibt für den Spielcode).
    - Flüsse neu (`carveRivers`): Mündung mit langem freiem Landweg, weiche Windungen, 2 Zellen breit. Ruby-Icon/Farbe = Akzent.
17. Update v15 (Kosmetik, `node tests/cosmetics.spec.js`):
    - Neue Arten `crown`, `pattern`, `ship` (backend.js `CROWNS/PATTERNS/SHIPS`, Profilfelder `crown/pattern/ship`, Supabase-Spalten + `protect_profile` + shop_items sind live eingespielt). Pixel-Entwürfe und Zeichenfunktionen in `cosmetics.js`.
    - Krone: Standard goldene Krone für den Gebietsführer (`leaderFid`), über dem Namen seiner Hauptstadt (game-world) und in der Bestenliste; Muster: `drawPatternCell` in `renderOwners` (nur eigene Gebiete); Schiff: `drawShip` in `drawSeaMarch` (nur eigene Flöße). Shop/Inventar mit Reitern (`COS_TABS`).
    - Rubys-Icon jetzt Pixel-Kristall.
18. Update v17 (Profilbild, `node tests/avatar.spec.js`): Upload im Profil (PNG/JPG/WebP, mittig auf 96×96 zugeschnitten, als Data-URL ≤30 kB in `profiles.avatar`), `safeAvatar()` validiert (kein SVG), Anzeige im Profil und Header, Entfernen-Knopf; Spalte + Check-Constraint live in Supabase, News v17. Avatare anderer Spieler werden noch nicht angezeigt.

19. Update v18 (Flaggen im Mehrspieler): `cosmPack/cosmClean` tragen `flag`, Weltkarte zeichnet die Flagge jeder Hauptstadt über `cosmOf(owner)`. Hüte bleiben nur in der eigenen Kolonie (fremde Kolonien sind nicht sichtbar). Tests `worldupdate`/`radial` nutzen jetzt feste Zufallsfolge (`SEED=n`), vorher wegen Zufallskarten gelegentlich rot.

## Offen (neu)
- Mehrspieler-Kosmetik (v16): Kronen/Muster/Schiffe werden beim Start gemeldet (`ready` → Host → `init`, `cosmPack/cosmClean/cosmOf`), „Kosmetik anderer ausblenden“ wirkt jetzt. Hüte/Flaggen anderer Spieler werden noch nicht synchronisiert; Bots tragen nur die Standardkrone.
- Bots nutzen die Bauleiste/Spenden nicht, Gebietsbeschriftung auf der Karte noch im alten Stil.
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

16. Update v19 (getestet: alle `tests/*.spec.js`, neu `quests.spec.js`):
    - Modi fest: Klassisch 2x, Schnell 3x, Chaos (Zufallsstart, 3x), Unlimited 3x; keine Tempo-Regler, Echtzeit-Timer (`rtime()`), keine Marionettenstaaten.
    - Automatische Wege/Händler/Kriegsschiffe in `js/game-trade.js`; SVG-Grafik und Skins in `js/svgart.js`; manuelles Wegemalen entfernt.
    - VSync-Fehler behoben (`nextFrame` in game-settings.js, Cap 1024 FPS); Eingabe-Fokus nach Reglern (`typing(e)`).
    - Quests neu (`QUESTS`/`CAREER` in backend.js, SQL-Migration am Ende von schema.sql); UI in `js/ui-quests.js` (Erfolge, Profil, Spielverlauf `Hist` lokal `aw_hist`, Bild-Zuschnitt `cropAvatar`).
    - Offen: SQL "Update v19" im Supabase-SQL-Editor ausführen; Events-Tab ist leer (Rahmen); Spielverlauf nur lokal, ohne Replay; neue Texte nur teils ins Englische übersetzt.

20. Update v20 – Öffentliche Spiele auf eigenem Server (getestet: `cd server && npm test`, `node tests/public-match.spec.js`, solo, multiplayer, worldupdate, radial, ui2):
    - Neu `server/`: Welt aus denselben Dateien (`game-core`, `game-world`, `game-sea`) in einem `vm`-Kontext je Match, Fraktion 0 als toter Platzhalter, Menschen 1…n. `room.js` (Countdown ab 2, 30 s Schonfrist, Bot-Übernahme), `protocol.js` (Schema, 4 KiB), `auth.js` (Supabase-JWKS, kein Geheimnis), `limits.js`, `index.js` (nur 127.0.0.1, Origin-Liste, 1 Verbindung je Konto, Sperrliste, `/healthz`, `/matches`). Lasttest `node server/test/load.js`: 10 Räume, 77 MB RSS, 0,8 % eines Kerns.
    - `startGame` geteilt in `initWorld({hostStart,humans})` + Kolonieteil; Host-Prinzip unverändert.
    - Client: `js/net-ws.js`, `NET.server`/`NET.roomId`, Karte kommt mit dem Raum-Seed, Bildschirm „Öffentliche Spiele“ (Liste alle 5 s, Beitritt, „Weiterspielen“ nach Neuladen) und Menüknopf.
    - `deploy/`: `harden.sh`, `check.sh`, `antwars-server.service` (MemoryMax 1G), `cloudflared-config.yml`, deutsche `ANLEITUNG-SERVER.md`.
    - News v20 in `DEFAULT_NEWS` und `supabase/schema.sql`.
    - Nachbesserung für die Einrichtung: `harden.sh` legt `/opt/antwars/server` nicht mehr vorab an (sonst verweigert `git clone` das Ziel); der Pages-Workflow reicht das Secret `SERVER_URL` an `gen-config.sh` durch, sonst bliebe die Serveradresse im Build leer.
    - Offen: `SERVER_URL` in `config.js`/Secrets setzen; Cloudflare-Tunnel und Domain beim Nutzer einrichten; SQL v20 im Supabase-SQL-Editor ausführen; kompletter Lauf gegen echtes Supabase steht aus.
