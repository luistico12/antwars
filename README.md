# Ant Wars

Ameisen-Kolonie bauen und die Weltkarte erobern. Ein statisches HTML5-Spiel (Canvas), UI im dunklen Glas-Design mit Akzent `#ff5757`.

## Lokal starten
`./scripts/gen-config.sh && python3 -m http.server 8000` und `http://localhost:8000` öffnen.
Ohne Supabase-Zugangsdaten läuft das Spiel im **Gastmodus** (Fortschritt nur im Browser).

## Backend (Supabase)
1. Projekt anlegen, `supabase/schema.sql` im SQL-Editor ausführen (Tabellen, RLS, RPCs, Ranglisten, Startdaten).
2. Authentication → Providers: E-Mail aktivieren, Google und Discord eintragen, optional Phone (SMS-Anbieter) für die Telefonnummer als Backup. Site URL und Redirect URL auf die Pages-Adresse setzen.
3. `.env` (siehe `.env.example`) lokal, bzw. GitHub → Settings → Secrets → Actions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Pages-Quelle: „GitHub Actions“.
4. Admin ernennen (nur per SQL): `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'du@example.com');`

## Sicherheit
- Keine eigene Passwortverarbeitung, nur das offizielle Supabase-SDK; Passwörter liegen nie in unseren Tabellen.
- RLS: Spieler lesen/ändern nur ihr eigenes Profil; privilegierte Spalten (Rubys, Siege, Besitz, Admin) schützt ein Trigger, Käufe/Quests laufen über RPCs. Admin-Rechte nur über Policies mit `is_admin()`.
- Spiel nur mit gültiger Session (sobald Supabase konfiguriert ist). Allgemeine Fehlermeldung „Ungültige Zugangsdaten“.
- Schlüssel stehen nur in `.env`/Secrets, `config.js` wird generiert und ist gitignored.

## Bekannte Grenzen
Spielstatistik wird vom Client gemeldet (serverseitig gedeckelt, aber nicht vollständig manipulationssicher). Lobby-Chat läuft über öffentliche Realtime-Broadcast-Kanäle. Oberfläche ist auf Deutsch und Englisch übersetzt. Werbefläche: eigenes Bild als `img/ad.png` ablegen.
