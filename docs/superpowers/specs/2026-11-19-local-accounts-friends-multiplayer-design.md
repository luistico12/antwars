# Lokale Konten, Freunde und Host-Multiplayer – Design

Stand: 2026-11-19. Vom Nutzer freigegeben ("entscheide selbst die beste Möglichkeit"), Umsetzungsentscheidungen sind Claudes Calls.

## Ziel und Warum
- Spieler sollen sofort spielen können, ohne Anmeldezwang. Trotzdem sollen Rangliste und Freundesliste funktionieren.
- Mehrere Spieler sollen gleichzeitig auf einer gemeinsamen Weltkarte spielen, ohne eigenen Server.

## Nicht-Ziele
- Kein eigener Server (später möglich, Transport austauschbar halten).
- Keine dauerhafte Weltkarte; endet der Host, endet die Partie.
- Kein Anti-Cheat gegen den Host.

## Anti-Ziele
- Kein eigenes Passwort-Handling, keine Schlüssel im Repo, RLS überall (CLAUDE.md).
- Der Offline-Gastmodus ohne config.js darf nicht kaputtgehen.

## Ansätze (Multiplayer)
1. Host sendet Schnappschüsse, Gäste senden Befehle (gewählt): wenig Code, passt zur bestehenden Realtime-Lobby.
2. WebRTC direkt: schneller, aber Signalisierung/TURN nötig, mehr Aufwand. Später über denselben Transport-Adapter möglich.
3. Lockstep: driftet mit Zufall und Bots, zu riskant.

## Konten
- Ohne Session: `signInAnonymously()` beim Start (Supabase), kein Login-Zwang mehr. Login bleibt optional (E-Mail, Google, Discord) über `updateUser`/`linkIdentity`, um das Konto zu sichern.
- Spielername frei wählbar (2–20 Zeichen). Dazu `tag` (4 Ziffern, 0001–9999), serverseitig zufällig vergeben; `unique(username, tag)`. Anzeige `Name#1234`. Vergabe in der DB (Trigger/RPC `set_username`), bei Kollision erneut würfeln.
- Lokaler Fallback ohne Supabase: gleiche Namen-/Tag-Logik im `Local`-Backend.
- Daten (Stats, Rubys, Cosmetics) laufen weiter über `AW.report/buy/claim/update` und die bestehenden RPCs.

## Freunde
- Tabelle `friendships(a uuid, b uuid, status 'pending'|'accepted', created_at)` mit RLS: nur Beteiligte sehen/ändern ihre Zeilen.
- RPCs: `friend_request(name, tag)`, `friend_respond(id, accept)`, `friend_remove(id)`; Antworten allgemein gehalten, kein Ausspähen von Namen.
- Neuer Screen "Freunde" (Liste, Anfragen, Hinzufügen per `Name#1234`), Rangliste kann Freunde hervorheben.

## Multiplayer
- Lobby existiert (Realtime-Kanal, Code, Chat). Neu: Transport-Adapter `Net` (`send`, `onmsg`, `leave`) über den bestehenden Kanal.
- Host: führt Welt, Bots, Kämpfe, Diplomatie; sendet ca. 2 Schnappschüsse/s (kompakt: Gebiete, Besitzer, Truppen, Ereignisse); wendet Gast-Befehle an (bauen, angreifen, Bündnis, Spenden).
- Gast: keine eigene Simulation, rendert den letzten Schnappschuss (interpoliert), sendet Befehle.
- Jeder Spieler hat einen Stamm/Startgebiet; Host-Austritt beendet die Partie für alle mit Hinweis.

## Offen für den Builder
- Genaues Schnappschuss-Format und Kolonie-Ansicht des Gasts (Kolonie bleibt pro Spieler lokal, Welt ist gemeinsam).
- Reihenfolge: Konten → Freunde → Multiplayer, jeweils getestet und gepusht.

## Veröffentlichung
Playwright-Tests, Push nach `main`, GitHub Pages. Nutzer führt `schema.sql` im SQL-Editor aus und aktiviert "Anonymous sign-ins". Gegen echtes Supabase untestbar; nur lokale Logik wird getestet.
