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

30. Update v21.9 – News vollständig aufgeklappt (getestet: `node --check`, Playwright im Gastmodus):
    - Ursache: `.sb` (Inhaltsbereich der Screens) ist ein Flex-Container mit `overflow:auto`; die Kinder schrumpften per Default (`flex-shrink:1`) auf die Bildschirmhöhe, `.nitem{overflow:hidden}` schnitt den Rest ab – ohne Scrollen.
    - Fix in `css/ui.css`: `.sb>*{flex:0 0 auto}` (volle Höhe, Container scrollt) und `.nitem.latest{overflow:visible}`.
    - News v21.9 in `DEFAULT_NEWS` und `schema.sql`.

29. Update v21.8 – Schwierigkeits-Regler, weniger Quests, große News (getestet: `node --check`, Playwright im Gastmodus, SQL live eingespielt):
    - Hauptmenü: der Schieberegler regelt jetzt die Schwierigkeit (Leicht/Normal/Schwer, `#hDiff` mit Skalenbeschriftung `#hDiffV`); die Gegnerzahl ist nicht mehr einstellbar, `MODES[modeKey].bots` gilt fest (`botCount` und `#hBots` entfernt, `js/game-world.js` nutzt wieder den Modus).
    - Modi-Auswahl: Karten zeigen nur noch Name und Tempo, die Beschreibungszeile und die Feldüberschrift „Modus“ sind weg (`js/ui-boot.js`, `css/ui.css`).
    - Erfolge: der Abhol-Bereich der Karriere-Karte ist immer groß – ohne fertige Stufe als gesperrte Fläche mit „ABHOLEN“ und Belohnung (`.cc-lock` in `js/ui-quests.js`/`css/ui.css`).
    - Quests: täglich fünf (Partien, Sieg, Eroberungen, Gebäude, Minuten) und wöchentlich vier (Partien, Eroberungen, Gebäude, Minuten); Bonusziele auf 5 bzw. 4 gesetzt (`js/backend.js`).
    - News: neuester Release als großer, standardmäßig aufgeklappter Hero mit Serifenschrift, größerem Fließtext und Initiale; die älteren Einträge bleiben als Liste (`S.news` in `js/ui-screens.js`, `css/ui.css`).
    - Shop: langer Erklärtext unter den Reitern entfernt (`js/ui-screens.js`).
    - News v21.8 in `DEFAULT_NEWS` und `schema.sql`, live eingespielt.

28. Update v21.7 – großer Abholen-Knopf, Clan-Logos, Menü-Regler (getestet: `node --check`, Playwright im Gastmodus, SQL live eingespielt):
    - Erfolge: der Abholen-Knopf füllt jetzt die ganze Karriere-Karte (orange, groß, mit Glanz und Aufleuchten wie in der Vorlage); die Belohnungszeile zeigt vorher nur noch den Wert (`js/ui-quests.js` `careerCard`, `css/ui.css`).
    - Clan-Logo: Upload in Gründung und „Clan bearbeiten“ (nur PNG/JPG/WebP, max. 4 MB, quadratisch auf 128 px zugeschnitten, als Data-URL ≤30 kB). `cropAvatar(f,out,mb)` ist jetzt größenparametrisiert. Anzeige als Wappen in Clan-Karte, Chat, Statistik, Suche und Einladungen (`clCrest(tag,color,cls,logo)`). `js/backend.js` (`clan_create`/`clan_update` mit `l`), Gastmodus speichert `logo`; `supabase/schema.sql` und Live-DB: Spalte `clans.logo`, Check-Constraint, neue Signaturen `clan_create(...,logo)`, `clan_update(...,logo)`, `clan_find` und `clan_invites` mit `logo`.
    - Hauptmenü: Schieberegler „Anzahl“ für 1–12 Gegner (`botCount`, `game-world.js` nutzt ihn beim Aufbau), Modi als Karten mit Name, Tempo und Beschreibung statt kleiner Pillen.
    - Werbefläche: Hintergrund als dunkler Farbverlauf statt Fläche, Plakat mit Glasrahmen und weicher Randblende; Menüblock steht auf PC/Tablet etwas höher (näher zur Mitte, nicht zentriert).
    - News v21.7 in `DEFAULT_NEWS` und `schema.sql`, englische Texte ergänzt.

27. Update v21.6 – Clans, Erfolge-Karten, Forum-Knopf, Sprachwahl, Handy (getestet: Playwright im Gastmodus, `node --check` aller geänderten Dateien, SQL live eingespielt):
    - Navigation: Forum-Knopf aus der Seitenleiste entfernt und als `#hdrForum` neben die News in die Kopfzeile (`js/ui-core.js`); Sprachwahl-Knopf `#hdrLang` entfernt, Sprache ist jetzt ein Reiter „Sprache“ im Einstellungsdialog (`js/game-settings.js`, `data-st="lang"`).
    - Forum: das Formular sieht jetzt jeder, auch Admins (`js/ui-screens.js`); Antwortfeld neutral „Antwort schreiben …“.
    - Quests: Karriere als Kartenraster im Stil der Vorlage – Kategorien links (`.qx-career .qx-cats`), Karten mit Symbolkachel, Stufenleiste, „FORTSCHRITT x/y“, Balken und Belohnungsleiste (`careerCard` in `js/ui-quests.js`); `css/ui.css` ergänzt. Abholen leuchtet: `.qx-claim` pulsiert, beim Klick `.pop` mit Ring (`bindClaims`), auch für Quest-Pillen im Spiel.
    - Clans (`js/ui-clan.js`, neu; `js/backend.js`): eigener Screen mit Reitern. Im Clan: Mitglieder (Liste mit Rolle, Siegen, zuletzt online; Aktionen für Besitzer/Admins: stumm, Admin/Mitglied, Besitzer, entfernen), Chat (Verlauf und Beitritte von heute, Poll alle 6 s), Statistik (Rang, Siege/Woche, Spiele, Siegquote, Mitglieder, beste Spieler Woche/Gesamt), Suche (Rangliste mit Beitreten/Anfragen/Voll/n Siege nötig). Ohne Clan: Übersicht mit „Clan gründen“ (600 Rubys) und „Clan finden“, Suche, Einladungen (an mich / meine Anfragen). Gründungsformular: Name, Tag (2–5, fest), Tagfarbe aus fester Palette, Beschreibung mit Markdown und klickbaren Discord-Links, offen/auf Anfrage, Mindest-Siege.
    - Clan-Tags sind nicht mehr frei wählbar: `clan_tag` wird nur noch von `clan_create`/`clan_join` gesetzt, das Feld im Profil ist entfernt (`js/ui-quests.js`).
    - `supabase/schema.sql`: Tabellen `clans`, `clan_members`, `clan_invites`, `clan_messages`, `profiles.clan_id`, RLS und 16 RPCs (`clan_my`, `clan_find`, `clan_create`, `clan_update`, `clan_members`, `clan_chat`, `clan_say`, `clan_join`, `clan_apply`, `clan_invite`, `clan_invites`, `clan_invite_respond`, `clan_member_act`, `clan_leave`, `clan_stats`, `clan_touch`); live eingespielt (16 Funktionen, 6 Policies, News v21.6).
    - Handy: nur ≤600 px – größere Tasten (Dock, Tempo, Weltkarten-Leiste), Dock mit Snap, Quest-Pille größer, Safe-Area für die Werbeleiste, Reiter der Kopfzeile umbrechen statt die Seite zu verbreitern. PC und Tablet unverändert.
    - News v21.6 in `DEFAULT_NEWS` und `schema.sql`, englische Texte ergänzt.

26. Update v21.5 – Forum für Bugs, Vorschläge und Spieler-Reports (getestet: `node .t.js` mit Playwright im Gastmodus, `node --check` aller geänderten Dateien):
    - Menüknopf „Forum“ in der Seitenleiste (`js/ui-boot.js`), Screen `S.forum` (`js/ui-screens.js`): links Formular für neue Meldungen (Art Bug / Vorschlag / Spieler-Report, Titel, Text) und die Liste, rechts der Verlauf mit Antworten. Admins sehen alle Meldungen mit Filter-Chips und können schließen, wieder öffnen, löschen und Rückfragen stellen; Spieler sehen nur ihre eigenen Meldungen und die Antworten darauf.
    - `js/backend.js`: `forumThreads/forumOpen/forumSend/forumReply/forumClose/forumDel` für Supabase (RPCs) und für den Gastmodus (localStorage, maximal 8 Meldungen pro Tag).
    - `supabase/schema.sql`: Tabellen `forum_threads`/`forum_posts`, RLS (Verfasser oder Admin), RPCs `forum_list`, `forum_open`, `forum_send`, `forum_reply`, `forum_close`, `forum_remove`; News v21.5.
    - Englische Texte in `js/i18n-en.js`.

25. Update v21.4 – Wege-Bug behoben: `buildLink` in `js/game-trade.js` hat die Route mit Gewichten 1-2-1 geglättet, aber durch 3 geteilt. Dadurch wurde jeder Weg pro Glättungsschritt um 4/3 gestreckt und zog sich in riesigen Bögen über die Karte (gemessen: 1292 px statt 233 px für 19 Zellen). Jetzt wird durch 4 geteilt; Wege folgen wieder dem kürzesten Weg (alle `tests/*.spec.js` außer multiplayer grün).
    - News v21.4 in `js/backend.js` und `supabase/schema.sql`, live in Supabase eingetragen.

24. Update v21.3 – viel mehr Karriere-Quests: 37 Quests mit je 4–5 Stufen (getestet: alle `tests/*.spec.js` außer multiplayer):
    - `CAREER` in `js/backend.js` von 20 auf 37 Linien erweitert (150 Stufen). Pro Statistik jetzt mehrere Quests mit steigenden Zielen: Partien (Veteran, Vielspieler, Spielmarathon), Tage (Stammgast, Gewohnheit), Zeit (Dienstzeit, Ausdauer), Siege (Sieger, Feldherr, Champion, Unbesiegbar), Gebiete (Eroberer, Belagerer, Feldzug, Imperium), Gebäude (Baumeister, Architekt, Stadtplaner, Metropole), Schiffe (Seewolf, Korsar, Admiral, Flottenherr), Bündnisse (Diplomat, Unterhändler, Botschafter, Friedensstifter), Funde (Schatzsucher, Ausgräber, Sammler, Archäologe), gleichzeitige Gebiete (Reichsgründer, Herrscher, Kontinent), Punkte (Punktejäger, Legende, Mythos).
    - Tages- (12) und Wochenquests (17) unverändert; Karriere-UI unverändert (Kategorie-Chips zeigen die neuen Zähler: Matches 7, Meisterleistungen 6, sonst 4).
    - `supabase/schema.sql` und Live-DB: `quests` 181 Zeilen (150 Karriere, 13 täglich inkl. Bonus, 18 wöchentlich inkl. Bonus), News v21.3; englische Namen der neuen Quests in `js/i18n-en.js`.

23. Update v21.2 – Karriere in 20 Quests mit je 4–5 Stufen, Quest-UI neu (getestet: alle `tests/*.spec.js` außer multiplayer):
    - GitHub Pages: der Actions-Workflow `.github/workflows/pages.yml` ist entfernt. Die Seite wird über „Deploy from a branch“ veröffentlicht (der Lauf „pages build and deployment“ ist bei jedem Push grün, die Seiteninhalte kommen direkt aus `main`). Der Actions-Workflow scheiterte dagegen immer in `deploy-pages@v4`, weil die Pages-Quelle kein Actions-Deploy erlaubt – bei erfolgreichem Push stand nur ein rotes X.
    - `CAREER` in `js/backend.js`: 20 Linien mit je 4–5 Stufen (82 Stufen). Neue Linien: Vielspieler, Feldherr, Belagerer, Architekt, Korsar, Unterhändler, Ausgräber, Herrscher, Legende. Tages- (12) und Wochenquests (17) unverändert.
    - Karriere-UI (`js/ui-quests.js`, `css/ui.css`): Kopf mit Stufen-/Quest-Zähler und Prozent-Ring, Kategorien als Chips statt Seitenleiste, Karten mit nummerierten Stufen-Punkten (erledigt/aktuell/offen), Prozent-Badge, Balken und Abholen-Knopf unten rechts.
    - CSS-Dopplung der v21-Sektion entfernt: die alten Karriere-Regeln kamen nach den neuen und machten aus den Kategorie-Chips eine gestapelte Liste.
    - Supabase live: `quests` 113 Zeilen (82 Karriere, 13 täglich inkl. Bonus, 18 wöchentlich inkl. Bonus), News v21.2.

22. Update v21.1 – Korrektur: Karriere zurück auf 44 Stufen, dafür mehr einzelne Quests (getestet: quests, cosmetics, solo, ui2, hud):
    - `CAREER` in `js/backend.js` wieder auf dem alten Stand (5/4/4/5/4/4/4/3/4/4/3 = 44 Stufen); Prozentwert und Balken bleiben korrekt.
    - Statt mehr Stufen jetzt mehr einzelne Quests: 12 Tagesquests (vorher 6) und 17 Wochenquests (vorher 10). Neue IDs: d_conq2, d_build2, d_found, d_sunk, d_allied, d_score, w_conq2, w_build2, w_sunk2, w_terr2, w_found2, w_allied2, w_score; der Bonus zählt automatisch alle Quests der Art.
    - Quest-Liste aufgeräumt: Symbol, Aufgabe und Belohnung in einer Zeile, Balken mit „x / y“ direkt darunter statt eigener Spalte „FORTSCHRITT“; Kopf als schmale Leiste mit Zurücksetzen-, Erledigt- und Serien-Pille plus Prozent-Ring; Karriere-Karten gleich hoch, „Stufe 2 / 5“ statt Strich-Punkten, Abholen-Knopf unten rechts.
    - `supabase/schema.sql` (Quest-Liste, News v21.1) und die Live-DB nachgezogen: 75 Zeilen (44 Karriere, 13 täglich inkl. Bonus, 18 wöchentlich inkl. Bonus). News v21 nennt jetzt 12/17 Quests und 44 Stufen.
    - Englische Titel der neuen Quests in `js/i18n-en.js`.

21. Update v21 – Liquid Glass, SVG-Skins, mehr Quests (getestet: quests, cosmetics, solo, ui2, hud, worldupdate, radial):
    - Liquid Glass in css/ui.css: Kopfzeile, Screens, Hauptmenü (rail, hhero, hact), Glas-Karten mit Lichtkante und tiefer Unschärfe; die Anzeige „Spieler des Tages“ ist jetzt eine Glas-Pille im FrontWars-Stil.
    - Alle Kosmetik als eigene SVG-Dateien: img/skins/hats (18), img/skins/crowns (13 inkl. Standardkrone), img/skins/ships (10), erzeugt von scripts/gen-skins.js. cosmetics.js lädt sie einmal je Datei und zeichnet sie per drawSkin (Hut auf Ameisen, Krone über der Hauptstadt und in der Bestenliste, Schiff auf Flößen). Muster sind neu (12, u. a. Waben, Schuppen, Pfeile).
    - Katalog und Preise angepasst (backend.js, svgart.js): neue Hüte, Kronen, Schiffe, Muster sowie Gebäude-, Händler- und Wege-Skins (Obsidian, Korallen, Neon, Schatten, Jade, Eis, Lava). Die Preise steigen mit der neuen Qualität.
    - Quests: 66 Karrierestufen (statt 44), 6 Tages- und 10 Wochenquests (je plus Bonus). UI neu: Kachel in Questfarbe, farbiger Fortschrittsbalken, großer orangener Abholen-Knopf mit Glanz, grüne „Abgeholt“-Markierung, Stufen-Punkte und ein Prozentwert, der abgeholte Stufen plus die laufende Stufe zählt (vorher zählten nur abgeholte Stufen).
    - Behoben: js/ui-screens.js war durch einen auskommentierten „Öffentliche Spiele“-Block syntaktisch kaputt (needLogin und mehrere Screens fehlten im Browser); der tote Block ist entfernt, der News-Screen ist wieder aktiv und der tote Knopf „Öffentliche Spiele“ im Hauptmenü ist weg.
    - Supabase live aktualisiert: shop_items (123 Artikel, neue Preise), quests (84 Zeilen, Tabelle neu aufgebaut) und News v21. Dasselbe SQL steht am Ende von supabase/schema.sql.
    - News v21 in DEFAULT_NEWS (js/backend.js) und am Ende von supabase/schema.sql.

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
    - Nachbesserung für die Einrichtung: `harden.sh` legt `/opt/antwars/server` nicht mehr vorab an (sonst verweigert `git clone` das Ziel); der Pages-Workflow reicht das Secret `SERVER_URL` an `gen-config.sh` durch, sonst bliebe die Serveradresse im Build leer. `harden.sh --root /mnt/storage/antwars` erlaubt einen anderen Projektpfad (`/opt/antwars` wird Symlink, `check.sh` folgt ihm).
    - Offen: `SERVER_URL` in `config.js`/Secrets setzen; Cloudflare-Tunnel und Domain beim Nutzer einrichten; SQL v20 im Supabase-SQL-Editor ausführen; kompletter Lauf gegen echtes Supabase steht aus.
    - Domain: öffentliche Serveradresse ist `https://antwars.123lumc.de` (gesetzt in `config.js`, `deploy/cloudflared-config.yml`, `deploy/ANLEITUNG-SERVER.md`; der Pages-Workflow fällt ohne Secret `SERVER_URL` darauf zurück). Über den Cloudflare-Connector ließ sich kein DNS-Eintrag anlegen: der Token darf keine Zonen lesen (Fehler 9109) und im Konto existiert noch kein Tunnel – Tunnel und Public Hostname `antwars.123lumc.de` → `HTTP 127.0.0.1:8787` entstehen im Dashboard und legen den CNAME selbst an.
