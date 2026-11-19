# Ant Wars

Ameisen-Kolonie bauen und die Weltkarte erobern. Ein statisches HTML5-Spiel (Canvas), UI im dunklen Glas-Design mit Akzent `#ff5757`.

## Lokal starten
`./scripts/gen-config.sh && python3 -m http.server 8000` und `http://localhost:8000` öffnen.
Ohne Supabase-Zugangsdaten läuft das Spiel im **Gastmodus** (Fortschritt nur im Browser).

## Backend (Supabase)
1. Projekt anlegen, `supabase/schema.sql` im SQL-Editor ausführen (Tabellen, RLS, RPCs, Ranglisten, Startdaten).
2. Authentication → Sign In / Providers → **Allow anonymous sign-ins** aktivieren (damit man ohne Anmeldung spielen kann; ohne den Schalter fällt das Spiel auf ein rein lokales Konto zurück).
3. Authentication → Providers: E-Mail aktivieren, Google und Discord eintragen, optional Phone (SMS-Anbieter) für die Telefonnummer als Backup. Site URL und Redirect URL auf die Pages-Adresse setzen.
3. `.env` (siehe `.env.example`) lokal, bzw. GitHub → Settings → Secrets → Actions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Pages-Quelle: „GitHub Actions“.
4. Admin ernennen (nur per SQL): `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'du@example.com');`

## Sicherheit
- Keine eigene Passwortverarbeitung, nur das offizielle Supabase-SDK; Passwörter liegen nie in unseren Tabellen.
- RLS: Spieler lesen/ändern nur ihr eigenes Profil; privilegierte Spalten (Rubys, Siege, Besitz, Admin) schützt ein Trigger, Käufe/Quests laufen über RPCs. Admin-Rechte nur über Policies mit `is_admin()`.
- Spiel nur mit gültiger Session (sobald Supabase konfiguriert ist). Allgemeine Fehlermeldung „Ungültige Zugangsdaten“.
- Schlüssel stehen nur in `.env`/Secrets, `config.js` wird generiert und ist gitignored.

## Bekannte Grenzen
Spielstatistik wird vom Client gemeldet (serverseitig gedeckelt, aber nicht vollständig manipulationssicher). Lobby-Chat läuft über öffentliche Realtime-Broadcast-Kanäle. Oberfläche ist auf Deutsch und Englisch übersetzt. Werbefläche: eigenes Bild als `img/ad.png` ablegen.

## Profil nachtragen / Admin setzen (falls Admin-Bereich fehlt)
Der Admin-Bereich erscheint nur, wenn `profiles.is_admin = true` ist. Hast du dich registriert, bevor `schema.sql` lief, existiert noch kein Profil. Im SQL-Editor:
```sql
insert into public.profiles(id, username, tag)
select u.id, u.n, public.new_tag(u.n) from (
  select id, left(coalesce(nullif(raw_user_meta_data->>'username',''), split_part(email,'@',1), 'Spieler'), 20) as n from auth.users
) u where char_length(u.n) >= 2
on conflict do nothing;
-- Admin: nur mit einem Konto, das eine E-Mail hat (anonyme Konten haben keine, siehe „Konto sichern“ im Profil)
update public.profiles set is_admin = true where id = (select id from auth.users where email = 'DEINE@MAIL.DE');
```
Änderungen im SQL-Editor/Table Editor des Dashboards bleiben bestehen; über das Spiel (Spieler-Token) kann sich niemand selbst zum Admin machen.
Danach im Spiel abmelden und neu anmelden.
