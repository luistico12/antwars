-- Ant Wars – Supabase Schema. Im SQL-Editor des Projekts einmal ausführen.
-- Auth (Passwörter, OAuth, Telefon-OTP) macht ausschließlich Supabase Auth. Hier liegen nur Spieldaten.

create extension if not exists pgcrypto;

-- ============ Tabellen ============
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Spieler' check (char_length(username) between 2 and 20),
  clan_tag text not null default '' check (clan_tag ~ '^[A-Z0-9]{0,5}$'),
  rubys int not null default 0 check (rubys >= 0),
  wins int not null default 0,
  games int not null default 0,
  hat text,
  flag text,
  avatar text check (avatar is null or (length(avatar) <= 30000 and avatar ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
  crown text,
  pattern text,
  ship text,
  owned text[] not null default '{}',
  quests jsonb not null default '{}',
  stats jsonb not null default '{}',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_items(
  id text primary key,          -- z.B. 'hat:crown', 'flag:de'
  price int not null check (price > 0)
);

create table if not exists public.quests(
  id text primary key,
  kind text not null check (kind in ('daily','weekly','career')),
  stat text not null,
  goal int not null,
  reward int not null
);

create table if not exists public.news(
  id uuid primary key default gen_random_uuid(),
  version text not null default '',
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.lobbies(
  id uuid primary key default gen_random_uuid(),
  code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,7),
  host uuid not null references auth.users(id) on delete cascade,
  host_name text not null default '',
  name text not null default 'Lobby',
  is_public boolean not null default false,
  diff text not null default 'normal',
  max int not null default 8 check (max between 2 and 50),
  seed int not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Tag (Discord-Stil): Name#1234, die Kombination (Name, Tag) ist einmalig
alter table public.profiles add column if not exists tag text not null default '0000' check (tag ~ '^[0-9]{4}$');

create or replace function public.new_tag(n text) returns text
language plpgsql security definer set search_path=public as $$
declare tg text; i int := 0;
begin
  loop
    tg := lpad((1 + floor(random()*9999))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where lower(username) = lower(n) and tag = tg);
    i := i + 1;
    if i > 300 then raise exception 'Kein freier Tag'; end if;
  end loop;
  return tg;
end $$;

do $$ declare r record; begin
  for r in select id, username from public.profiles where tag = '0000' loop
    update public.profiles set tag = public.new_tag(r.username) where id = r.id;
  end loop;
end $$;
create unique index if not exists profiles_name_tag on public.profiles (lower(username), tag);

-- ============ Hilfsfunktionen ============
create or replace function public.is_admin() returns boolean
language sql security definer set search_path=public stable as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare nm text;
begin
  nm := left(trim(regexp_replace(coalesce(nullif(trim(new.raw_user_meta_data->>'username'),''), nullif(trim(new.raw_user_meta_data->>'full_name'),''), 'Spieler'), '[#\s]+', ' ', 'g')),20);
  if char_length(nm) < 2 then nm := 'Spieler'; end if;
  insert into public.profiles(id, username, tag) values (new.id, nm, public.new_tag(nm))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Schützt privilegierte Spalten: Spieler dürfen nur Name, Clan-Tag, Hut und Flagge ändern (und nur Besitz ausrüsten).
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  -- auth.uid() ist null bei Änderungen aus dem Supabase-Dashboard/SQL-Editor (kein Spieler-Token): die dürfen alles.
  if auth.uid() is null or coalesce(current_setting('app.rpc', true),'') = '1' or public.is_admin() then return new; end if;
  new.rubys := old.rubys; new.wins := old.wins; new.games := old.games; new.owned := old.owned;
  new.username := old.username; new.tag := old.tag; new.quests := old.quests; new.stats := old.stats; new.is_admin := old.is_admin; new.id := old.id; new.created_at := old.created_at;
  -- Clan-Tag und Clan-Zugehörigkeit vergibt nur noch die Clan-Logik (clan_create/clan_join/clan_leave).
  new.clan_tag := old.clan_tag; new.clan_id := old.clan_id;
  if new.hat is not null and not ('hat:'||new.hat) = any(old.owned) then new.hat := old.hat; end if;
  if new.flag is not null and not ('flag:'||new.flag) = any(old.owned) then new.flag := old.flag; end if;
  if new.crown is not null and not ('crown:'||new.crown) = any(old.owned) then new.crown := old.crown; end if;
  if new.pattern is not null and not ('pattern:'||new.pattern) = any(old.owned) then new.pattern := old.pattern; end if;
  if new.ship is not null and not ('ship:'||new.ship) = any(old.owned) then new.ship := old.ship; end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- ============ RPCs (nur eingeloggt) ============
create or replace function public.buy_item(item text) returns void
language plpgsql security definer set search_path=public as $$
declare p int; me public.profiles;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select price into p from public.shop_items where id = item;
  if p is null then raise exception 'Unbekannter Artikel'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if item = any(me.owned) then raise exception 'Schon gekauft'; end if;
  if me.rubys < p then raise exception 'Nicht genug Rubys'; end if;
  perform set_config('app.rpc','1',true);
  update public.profiles set rubys = rubys - p, owned = owned || item where id = auth.uid();
end $$;

-- Statistik melden: Zuwächse werden begrenzt (Max-Werte wie Gebiete/Punkte werden gedeckelt).
create or replace function public.report_stats(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare me public.profiles; st jsonb; kind text; k text; key text; v numeric; cur numeric; b jsonb; nowk text;
        keys text[] := array['games','wins','found','allied','terr','score'];
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  st := me.stats;
  foreach kind in array array['daily','weekly','career'] loop
    nowk := case kind when 'daily' then to_char(now() at time zone 'utc','YYYY-MM-DD')
                      when 'weekly' then to_char(now() at time zone 'utc','IYYY-"W"IW') else 'c' end;
    b := st->kind;
    if b is null or b->>'k' is distinct from nowk then b := jsonb_build_object('k',nowk,'v','{}'::jsonb); end if;
    foreach key in array keys loop
      if p ? key then
        v := greatest(0, least(500, coalesce((p->>key)::numeric,0)));
        cur := coalesce((b->'v'->>key)::numeric,0);
        if key in ('terr','score') then cur := greatest(cur, v); else cur := cur + least(v,50); end if;
        b := jsonb_set(b, array['v',key], to_jsonb(cur));
      end if;
    end loop;
    st := jsonb_set(coalesce(st,'{}'::jsonb), array[kind], b);
  end loop;
  perform set_config('app.rpc','1',true);
  update public.profiles set stats = st,
    games = games + least(1, greatest(0, coalesce((p->>'games')::int,0))),
    wins  = wins  + least(1, greatest(0, coalesce((p->>'wins')::int,0)))
  where id = auth.uid();
end $$;

create or replace function public.claim_quest(qid text) returns void
language plpgsql security definer set search_path=public as $$
declare q public.quests; me public.profiles; b jsonb; nowk text; have numeric;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into q from public.quests where id = qid;
  if q.id is null then raise exception 'Unbekannt'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  nowk := case q.kind when 'daily' then to_char(now() at time zone 'utc','YYYY-MM-DD')
                      when 'weekly' then to_char(now() at time zone 'utc','IYYY-"W"IW') else 'c' end;
  b := me.stats->q.kind;
  if b is null or b->>'k' is distinct from nowk then raise exception 'Noch nicht geschafft'; end if;
  have := coalesce((b->'v'->>q.stat)::numeric,0);
  if have < q.goal then raise exception 'Noch nicht geschafft'; end if;
  if me.quests->>qid = nowk then raise exception 'Schon abgeholt'; end if;
  perform set_config('app.rpc','1',true);
  update public.profiles set rubys = rubys + q.reward, quests = jsonb_set(quests, array[qid], to_jsonb(nowk)) where id = auth.uid();
end $$;

-- Name ändern: bereinigt den Namen und vergibt bei neuem Namen einen neuen Tag
create or replace function public.set_username(n text) returns text
language plpgsql security definer set search_path=public as $$
declare nm text; me public.profiles; tg text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  nm := left(trim(regexp_replace(coalesce(n,''), '[#\s]+', ' ', 'g')),20);
  if char_length(nm) < 2 then raise exception 'Name zu kurz'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  perform set_config('app.rpc','1',true);
  if lower(me.username) = lower(nm) then
    update public.profiles set username = nm where id = auth.uid();
    return me.tag;
  end if;
  tg := public.new_tag(nm);
  update public.profiles set username = nm, tag = tg where id = auth.uid();
  return tg;
end $$;

-- Lobby per Code finden (auch private) – gibt nur diese eine Zeile zurück
create or replace function public.find_lobby(c text) returns setof public.lobbies
language sql security definer set search_path=public stable as
$$ select * from public.lobbies where code = c and status = 'open' limit 1 $$;

-- ============ Ranglisten (nur öffentliche Spalten) ============
create or replace view public.leaderboard_players with (security_invoker=false) as
  select username, clan_tag, wins, games, tag from public.profiles where games > 0;
create or replace view public.leaderboard_clans with (security_invoker=false) as
  select clan_tag, sum(wins)::int as wins, sum(games)::int as games, count(*)::int as members
  from public.profiles where clan_tag <> '' group by clan_tag;
grant select on public.leaderboard_players, public.leaderboard_clans to anon, authenticated;

-- ============ Row Level Security ============
alter table public.profiles   enable row level security;
alter table public.shop_items enable row level security;
alter table public.quests     enable row level security;
alter table public.news       enable row level security;
alter table public.lobbies    enable row level security;

-- Profile: jeder Spieler nur das eigene; Admins alle
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
-- kein insert/delete-Policy: Profile entstehen nur über den Auth-Trigger, Löschung über auth.users (cascade)

-- Katalog: lesen für alle Angemeldeten, schreiben nur Admin
drop policy if exists shop_read on public.shop_items;  create policy shop_read on public.shop_items for select to authenticated using (true);
drop policy if exists shop_admin on public.shop_items; create policy shop_admin on public.shop_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists quests_read on public.quests;    create policy quests_read on public.quests for select to authenticated using (true);
drop policy if exists quests_admin on public.quests;   create policy quests_admin on public.quests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- News: alle lesen, nur Admin schreibt
drop policy if exists news_read on public.news;  create policy news_read on public.news for select to anon, authenticated using (true);
drop policy if exists news_admin on public.news; create policy news_admin on public.news for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lobbys: öffentliche sichtbar, Host verwaltet seine eigene
drop policy if exists lob_read on public.lobbies;   create policy lob_read on public.lobbies for select to authenticated using (is_public or host = auth.uid());
drop policy if exists lob_insert on public.lobbies; create policy lob_insert on public.lobbies for insert to authenticated with check (host = auth.uid());
drop policy if exists lob_update on public.lobbies; create policy lob_update on public.lobbies for update to authenticated using (host = auth.uid()) with check (host = auth.uid());
drop policy if exists lob_delete on public.lobbies; create policy lob_delete on public.lobbies for delete to authenticated using (host = auth.uid());

-- Funktionen nur für Angemeldete
revoke all on function public.buy_item(text), public.claim_quest(text), public.report_stats(jsonb), public.find_lobby(text) from public, anon;
grant execute on function public.buy_item(text), public.claim_quest(text), public.report_stats(jsonb), public.find_lobby(text) to authenticated;

-- ============ Startdaten ============
insert into public.shop_items(id,price) values
 ('hat:cap',1),('hat:flower',1),('hat:party',1),('hat:helmet',2),('hat:top',2),('hat:pirate',2),('hat:wizard',3),('hat:crown',3),('hat:halo',4),
 ('flag:a_red',2),('flag:a_green',2),('flag:a_gold',2),('flag:a_stripe',2),('flag:a_mound',3),('flag:a_fungus',3),('flag:a_swords',3),('flag:a_queen',3)
on conflict (id) do update set price = excluded.price;
insert into public.shop_items(id,price)
 select 'flag:'||c, case when c in ('de','gb','us','fr','es','it','nl','pl') then 1 else 2 end
 from unnest(array['de','gb','us','fr','es','it','nl','pl','pt','br','ar','mx','ca','au','jp','kr','cn','in','tr','ru','ua','se','no','dk','fi','at','ch','ie','be','gr','cz','hu','ro','bg','rs','sk','si','il','sa','eg','za','bd','mk']) c
on conflict (id) do update set price = excluded.price;
-- Update v17: Profilbild
alter table public.profiles add column if not exists avatar text;
do $$ begin alter table public.profiles add constraint profiles_avatar_chk check (avatar is null or (length(avatar) <= 30000 and avatar ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')); exception when duplicate_object then null; end $$;
-- Update v15: Kronen, Muster, Schiffe
alter table public.profiles add column if not exists crown text;
alter table public.profiles add column if not exists pattern text;
alter table public.profiles add column if not exists ship text;
insert into public.shop_items(id,price) values
 ('crown:monarch',2),('crown:ruby',3),('crown:amethyst',4),('crown:laurel',6),('crown:halo',6),('crown:inferno',8),('crown:prism',12),
 ('pattern:stripes',2),('pattern:checker',2),('pattern:dots',2),('pattern:bricks',3),('pattern:hearts',3),('pattern:stars',3),('pattern:waves',4),('pattern:grid',4),
 ('ship:leaf',2),('ship:viking',3),('ship:duck',3),('ship:steam',4),('ship:pirate',5),('ship:golden',8)
on conflict (id) do update set price = excluded.price;
insert into public.quests(id,kind,stat,goal,reward) values
 ('d_games','daily','games',1,1),('d_terr','daily','terr',3,1),('d_found','daily','found',1,1),
 ('w_games','weekly','games',5,2),('w_wins','weekly','wins',1,3),('w_terr','weekly','terr',8,2),
 ('c_games','career','games',10,2),('c_wins','career','wins',5,5),('c_terr','career','terr',12,3),('c_found','career','found',25,3),('c_allied','career','allied',1,1),('c_score','career','score',300,3)
on conflict (id) do update set kind=excluded.kind, stat=excluded.stat, goal=excluded.goal, reward=excluded.reward;
insert into public.news(version,title,body) values ('v11','Neues Design, Konten und Shop','Komplett neues Glas-Interface, Anmeldung per E-Mail, GitHub oder Discord, Rubys durch Quests, Hüte und Flaggen im Shop, Clans über freie Tags und Ranglisten.');

-- Admin ernennen (manuell, einmalig, im SQL-Editor – NICHT über die App):
--   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'du@example.com');

-- ============ Freunde ============
-- Anfragen und Freundschaften. Schreiben nur über die RPCs unten, lesen nur die eigenen Zeilen.
create table if not exists public.friendships(
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
drop policy if exists friendships_own_select on public.friendships;
create policy friendships_own_select on public.friendships for select to authenticated using (requester = auth.uid() or addressee = auth.uid());

-- Anfrage per Name + Tag. Antwort ist immer 'ok' (verrät nicht, ob der Spieler existiert).
create or replace function public.friend_request(n text, tg text) returns text
language plpgsql security definer set search_path=public as $$
declare other uuid; ex public.friendships;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select id into other from public.profiles where lower(username) = lower(trim(n)) and tag = tg;
  if other is null or other = auth.uid() then return 'ok'; end if;
  select * into ex from public.friendships
    where least(requester, addressee) = least(auth.uid(), other) and greatest(requester, addressee) = greatest(auth.uid(), other);
  if ex.id is null then
    if (select count(*) from public.friendships where requester = auth.uid() and status = 'pending') >= 50 then return 'ok'; end if;
    insert into public.friendships(requester, addressee) values (auth.uid(), other);
  elsif ex.status = 'pending' and ex.addressee = auth.uid() then
    update public.friendships set status = 'accepted' where id = ex.id;  -- beide wollten sich: gleich Freunde
  end if;
  return 'ok';
end $$;

create or replace function public.friend_respond(fid uuid, acc boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if acc then
    update public.friendships set status = 'accepted' where id = fid and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where id = fid and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

create or replace function public.friend_remove(fid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  delete from public.friendships where id = fid and (requester = auth.uid() or addressee = auth.uid());
end $$;

-- Eigene Freunde und Anfragen inkl. Name/Tag der Gegenseite
create or replace function public.my_friends() returns table(id uuid, other_id uuid, username text, tag text, status text, incoming boolean)
language sql security definer set search_path=public stable as $$
  select f.id, p.id, p.username, p.tag, f.status, (f.addressee = auth.uid())
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() is not null and (f.requester = auth.uid() or f.addressee = auth.uid())
  order by p.username
$$;
revoke all on function public.friend_request(text,text), public.friend_respond(uuid,boolean), public.friend_remove(uuid), public.my_friends() from public, anon;
grant execute on function public.friend_request(text,text), public.friend_respond(uuid,boolean), public.friend_remove(uuid), public.my_friends() to authenticated;

-- ============ Spieler des Tages (v13) ============
create or replace view public.player_of_day with (security_invoker=false) as
  select p.username, p.clan_tag, coalesce((p.stats->'daily'->'v'->>'wins')::int,0) as wins
  from public.profiles p
  where p.stats->'daily'->>'k' = to_char(now() at time zone 'utc','YYYY-MM-DD')
  order by wins desc limit 1;
grant select on public.player_of_day to anon, authenticated;

-- News-Releases (nach jedem Update einen neuen eintragen, siehe CLAUDE.md)
insert into public.news(version,title,body)
select 'v12','Tunnelansicht und neue Weltkarte','Taste T zeigt in der Kolonie grün Gegrabenes und rot Unbebaubares: Linksklick markiert, ziehen malt mehrere, Tunnel sind 2,5× schneller. Auf der Weltkarte verschmelzen eigene Gebiete, die Hauptstadt wird mit dem Reich größer. Rechtsklick aufs eigene Gebiet öffnet das Bauen-Menü: Verteidigungswall, Außenposten, Linien, Hafen, Floß, Wege. Marionettenstaaten geben einen Teil der Beute.'
where not exists (select 1 from public.news where version='v12');
insert into public.news(version,title,body)
select 'v13','Modi, Unlimited, Flüsse und viele Neuerungen','Neuer Modus-Knopf im Startmenü: FFA (7 Gegner) und Unlimited (3,5× große Karte, doppelt so große Kolonie, 5 Gegner, kein Ende). Das Startgebiet wählst du jetzt in 15 Sekunden direkt auf der Karte. Flüsse auf der Karte: baue Häfen und Flöße daran. Flöße fahren jetzt nur noch über Wasser. Spielzeit im Kopf, nach einem Sieg kannst du weiterspielen, Rechtsklick halten baut mehrere Räume. Tasten: Q/R scrollen, 1/2/3 Reiter, Tab wechselt Kolonie und Karte. Neu: Inventar für Kosmetik, Spieler des Tages, mehr Einstellungen (Tasten, VSync, FPS-Limit, Grafikqualität, Interface-Größe, Standard-Truppenanteil), roter Rahmen bei Angriffen und Quest-Anzeige im Spiel.'
where not exists (select 1 from public.news where version='v13');

insert into public.news(version,title,body)
select 'v14','Neue Weltkarten-Oberfläche','Die Weltkarte sieht jetzt aus wie bei FrontWars: Bestenliste links oben (Besitz, Gebiete, Truppen), unten die Bauleiste mit den Tasten 1 bis 6 (Wall, Außenposten, Linie, Hafen, Floß, Weg), Material und Truppen mit Anteilsleiste sowie Leisten zum Spenden von Truppen und Material. Unten rechts stehen Ereignisse und das Team. Das Seitenpanel rechts ist weg, Bauen geht über die Leiste oder per Rechtsklick. Die Flüsse winden sich jetzt natürlicher durchs Land, und die Rubys sind jetzt rote Kristalle in der Akzentfarbe.'
where not exists (select 1 from public.news where version='v14');

insert into public.news(version,title,body)
select 'v15','Kronen, Muster und Schiffe','Neue Kosmetik im Shop: Kronen, Muster und Schiffe. Die Krone trägt, wer das meiste Land hat: Sie steht über dem Namen seiner Hauptstadt und in der Bestenliste, alle tragen standardmäßig die goldene Krone, im Shop gibt es sieben weitere. Muster färben deine Gebiete auf der Weltkarte (acht Stück), Schiffe ersetzen dein Floß auf dem Wasser (sechs Stück). Alles lässt sich im Inventar ausrüsten. Die Rubys sind jetzt Pixel-Kristalle.'
where not exists (select 1 from public.news where version='v15');

insert into public.news(version,title,body)
select 'v16','Kosmetik im Mehrspieler','Im Mehrspieler siehst du jetzt die Kosmetik der anderen: ihre Krone, ihr Muster auf der Karte und ihr Schiff auf dem Wasser. Wer die Kosmetik anderer nicht sehen mag, schaltet sie in den Einstellungen unter Spiel aus.'
where not exists (select 1 from public.news where version='v16');

insert into public.news(version,title,body)
select 'v17','Profilbild hochladen','Du kannst jetzt ein eigenes Profilbild hochladen. Öffne dein Profil, wähle ein Bild (PNG, JPG oder WebP), es wird mittig zugeschnitten und klein gespeichert. Es erscheint im Profil und oben im Header, mit dem Papierkorb-Knopf entfernst du es wieder.'
where not exists (select 1 from public.news where version='v17');

insert into public.news(version,title,body)
select 'v18','Flaggen im Mehrspieler','Im Mehrspieler siehst du jetzt auch die Flaggen der anderen: Sie wehen auf der Hauptstadt des jeweiligen Spielers. Wer fremde Kosmetik nicht sehen mag, blendet sie in den Einstellungen unter Spiel aus.'
where not exists (select 1 from public.news where version='v18');

-- ============ Update v19: Skins, neue Quests, Tagesserie ============
alter table public.profiles add column if not exists bskin text;
alter table public.profiles add column if not exists tskin text;
alter table public.profiles add column if not exists rskin text;
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  -- auth.uid() ist null bei Änderungen aus dem Supabase-Dashboard/SQL-Editor (kein Spieler-Token): die dürfen alles.
  if auth.uid() is null or coalesce(current_setting('app.rpc', true),'') = '1' or public.is_admin() then return new; end if;
  new.rubys := old.rubys; new.wins := old.wins; new.games := old.games; new.owned := old.owned;
  new.username := old.username; new.tag := old.tag; new.quests := old.quests; new.stats := old.stats; new.is_admin := old.is_admin; new.id := old.id; new.created_at := old.created_at;
  -- Clan-Tag und Clan-Zugehörigkeit vergibt nur noch die Clan-Logik (clan_create/clan_join/clan_leave).
  new.clan_tag := old.clan_tag; new.clan_id := old.clan_id;
  if new.hat is not null and not ('hat:'||new.hat) = any(old.owned) then new.hat := old.hat; end if;
  if new.flag is not null and not ('flag:'||new.flag) = any(old.owned) then new.flag := old.flag; end if;
  if new.crown is not null and not ('crown:'||new.crown) = any(old.owned) then new.crown := old.crown; end if;
  if new.pattern is not null and not ('pattern:'||new.pattern) = any(old.owned) then new.pattern := old.pattern; end if;
  if new.ship is not null and not ('ship:'||new.ship) = any(old.owned) then new.ship := old.ship; end if;
  if new.bskin is not null and not ('bskin:'||new.bskin) = any(old.owned) then new.bskin := old.bskin; end if;
  if new.tskin is not null and not ('tskin:'||new.tskin) = any(old.owned) then new.tskin := old.tskin; end if;
  if new.rskin is not null and not ('rskin:'||new.rskin) = any(old.owned) then new.rskin := old.rskin; end if;
  return new;
end $$;
insert into public.shop_items(id,price) values
 ('bskin:stone',70), ('bskin:mush',90), ('bskin:frost',110), ('bskin:crystal',140), ('bskin:golden',200), ('tskin:moss',60), ('tskin:mail',90), ('tskin:royal',130), ('tskin:golden',180), ('rskin:cobble',70), ('rskin:moss',90), ('rskin:gold',160), ('rskin:neon',180)
on conflict (id) do update set price = excluded.price;
-- Quests: alte Einträge entfernen, neue samt höheren Belohnungen eintragen (stat 'bonus' = alle anderen Quests der Art abgeholt)
delete from public.quests where id not in ('d_games','d_terr','d_build','b_daily','w_games','w_wins','w_days','w_conq','w_build','w_sunk','b_weekly','c_games_1','c_games_2','c_games_3','c_games_4','c_games_5','c_days_1','c_days_2','c_days_3','c_days_4','c_mins_1','c_mins_2','c_mins_3','c_mins_4','c_wins_1','c_wins_2','c_wins_3','c_wins_4','c_wins_5','c_conq_1','c_conq_2','c_conq_3','c_conq_4','c_built_1','c_built_2','c_built_3','c_built_4','c_sunk_1','c_sunk_2','c_sunk_3','c_sunk_4','c_allied_1','c_allied_2','c_allied_3','c_found_1','c_found_2','c_found_3','c_found_4','c_terr_1','c_terr_2','c_terr_3','c_terr_4','c_score_1','c_score_2','c_score_3');
insert into public.quests(id,kind,stat,goal,reward) values
 ('d_games','daily','games',2,3),
 ('d_terr','daily','terr',3,4),
 ('d_build','daily','built',8,6),
 ('b_daily','daily','bonus',3,4),
 ('w_games','weekly','games',5,10),
 ('w_wins','weekly','wins',1,14),
 ('w_days','weekly','days',3,14),
 ('w_conq','weekly','conq',10,12),
 ('w_build','weekly','built',40,14),
 ('w_sunk','weekly','sunk',3,16),
 ('b_weekly','weekly','bonus',6,16),
 ('c_games_1','career','games',5,10),
 ('c_games_2','career','games',15,20),
 ('c_games_3','career','games',40,40),
 ('c_games_4','career','games',100,80),
 ('c_games_5','career','games',250,160),
 ('c_days_1','career','days',3,10),
 ('c_days_2','career','days',7,25),
 ('c_days_3','career','days',20,60),
 ('c_days_4','career','days',50,130),
 ('c_mins_1','career','mins',30,8),
 ('c_mins_2','career','mins',120,20),
 ('c_mins_3','career','mins',480,55),
 ('c_mins_4','career','mins',1500,130),
 ('c_wins_1','career','wins',1,12),
 ('c_wins_2','career','wins',5,25),
 ('c_wins_3','career','wins',15,50),
 ('c_wins_4','career','wins',40,100),
 ('c_wins_5','career','wins',100,200),
 ('c_conq_1','career','conq',10,12),
 ('c_conq_2','career','conq',50,30),
 ('c_conq_3','career','conq',150,70),
 ('c_conq_4','career','conq',400,140),
 ('c_built_1','career','built',10,10),
 ('c_built_2','career','built',50,25),
 ('c_built_3','career','built',150,60),
 ('c_built_4','career','built',400,120),
 ('c_sunk_1','career','sunk',1,15),
 ('c_sunk_2','career','sunk',5,35),
 ('c_sunk_3','career','sunk',15,80),
 ('c_sunk_4','career','sunk',40,160),
 ('c_allied_1','career','allied',1,8),
 ('c_allied_2','career','allied',5,25),
 ('c_allied_3','career','allied',15,60),
 ('c_found_1','career','found',5,8),
 ('c_found_2','career','found',25,20),
 ('c_found_3','career','found',75,50),
 ('c_found_4','career','found',200,110),
 ('c_terr_1','career','terr',5,8),
 ('c_terr_2','career','terr',10,20),
 ('c_terr_3','career','terr',20,50),
 ('c_terr_4','career','terr',35,110),
 ('c_score_1','career','score',300,10),
 ('c_score_2','career','score',1000,30),
 ('c_score_3','career','score',3000,80)
on conflict (id) do update set kind=excluded.kind, stat=excluded.stat, goal=excluded.goal, reward=excluded.reward;
create or replace function public.report_stats(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare me public.profiles; st jsonb; kind text; k text; key text; v numeric; cur numeric; b jsonb; nowk text;
        keys text[] := array['games','wins','found','allied','terr','score','built','conq','sunk','mins'];
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  st := me.stats;
  foreach kind in array array['daily','weekly','career'] loop
    nowk := case kind when 'daily' then to_char(now() at time zone 'utc','YYYY-MM-DD')
                      when 'weekly' then to_char(now() at time zone 'utc','IYYY-"W"IW') else 'c' end;
    b := st->kind;
    if b is null or b->>'k' is distinct from nowk then b := jsonb_build_object('k',nowk,'v','{}'::jsonb); end if;
    foreach key in array keys loop
      if p ? key then
        v := greatest(0, least(500, coalesce((p->>key)::numeric,0)));
        cur := coalesce((b->'v'->>key)::numeric,0);
        if key in ('terr','score') then cur := greatest(cur, v); else cur := cur + least(v,50); end if;
        b := jsonb_set(b, array['v',key], to_jsonb(cur));
      end if;
    end loop;
    if coalesce((p->>'games')::int,0) > 0 and coalesce(b->'v'->>'dl','') <> to_char(now() at time zone 'utc','YYYY-MM-DD') then
      b := jsonb_set(b, array['v','dl'], to_jsonb(to_char(now() at time zone 'utc','YYYY-MM-DD')));
      b := jsonb_set(b, array['v','days'], to_jsonb(coalesce((b->'v'->>'days')::numeric,0) + 1));
    end if;
    st := jsonb_set(coalesce(st,'{}'::jsonb), array[kind], b);
  end loop;
  -- Tagesserie: aufeinanderfolgende Tage mit mindestens einer Partie
  if coalesce((p->>'games')::int,0) > 0 then
    st := jsonb_set(st, '{streak}', case
      when coalesce(st->'streak'->>'last','') = to_char(now() at time zone 'utc','YYYY-MM-DD') then st->'streak'
      when coalesce(st->'streak'->>'last','') = to_char((now() at time zone 'utc') - interval '1 day','YYYY-MM-DD')
        then jsonb_build_object('n', coalesce((st->'streak'->>'n')::int,0) + 1, 'last', to_char(now() at time zone 'utc','YYYY-MM-DD'))
      else jsonb_build_object('n', 1, 'last', to_char(now() at time zone 'utc','YYYY-MM-DD')) end);
  end if;
  perform set_config('app.rpc','1',true);
  update public.profiles set stats = st,
    games = games + least(1, greatest(0, coalesce((p->>'games')::int,0))),
    wins  = wins  + least(1, greatest(0, coalesce((p->>'wins')::int,0)))
  where id = auth.uid();
end $$;
create or replace function public.claim_quest(qid text) returns void
language plpgsql security definer set search_path=public as $$
declare q public.quests; me public.profiles; b jsonb; nowk text; have numeric;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into q from public.quests where id = qid;
  if q.id is null then raise exception 'Unbekannt'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  nowk := case q.kind when 'daily' then to_char(now() at time zone 'utc','YYYY-MM-DD')
                      when 'weekly' then to_char(now() at time zone 'utc','IYYY-"W"IW') else 'c' end;
  b := me.stats->q.kind;
  if b is null or b->>'k' is distinct from nowk then raise exception 'Noch nicht geschafft'; end if;
  if q.stat = 'bonus' then
    if exists (select 1 from public.quests o where o.kind = q.kind and o.stat <> 'bonus' and coalesce(me.quests->>o.id,'') is distinct from nowk) then raise exception 'Noch nicht geschafft'; end if;
  else
    have := coalesce((b->'v'->>q.stat)::numeric,0);
    if have < q.goal then raise exception 'Noch nicht geschafft'; end if;
  end if;
  if me.quests->>qid = nowk then raise exception 'Schon abgeholt'; end if;
  perform set_config('app.rpc','1',true);
  update public.profiles set rubys = rubys + q.reward, quests = jsonb_set(quests, array[qid], to_jsonb(nowk)) where id = auth.uid();
end $$;

-- News v19
insert into public.news (version, title, body)
select 'v19', 'Erfolge, Profil und Weltkarte neu', 'Großes Update im Stil von FrontWars: Erfolge mit Täglich, Wöchentlich, Karriere und Events, dazu Tagesserie und Bonus-Belohnungen. Das Profil zeigt Statistiken, Modi und die letzten Spiele, dein Profilbild schneidest du selbst zu. Neu im Spiel: automatische Wege mit Händlern, Kriegsschiffe, feste Modi (Klassisch 2x, Schnell 3x, Chaos), keine Marionettenstaaten mehr, Skins für Gebäude, Händler und Wege sowie schärfere Grafik. Außerdem behoben: Tasten nach dem Benutzen der Regler und der VSync-Fehler.'
where not exists (select 1 from public.news where version = 'v19');

-- ============ Update v21: SVG-Skins, neue Preise, mehr Quests ============
insert into public.shop_items(id,price) values
 ('crown:monarch',4), ('crown:ruby',6), ('crown:coral',7), ('crown:amethyst',8), ('crown:toxic',8), ('crown:laurel',10), ('crown:halo',10), ('crown:frost',11), ('crown:inferno',13), ('crown:prism',16), ('crown:sun',18), ('crown:obsidian',22), ('pattern:stripes',3), ('pattern:diagonal',3), ('pattern:checker',3), ('pattern:dots',3), ('pattern:bricks',4), ('pattern:hearts',4), ('pattern:stars',4), ('pattern:waves',5), ('pattern:grid',5), ('pattern:arrows',5), ('pattern:hexes',6), ('pattern:scales',6), ('ship:leaf',4), ('ship:paper',5), ('ship:duck',6), ('ship:turtle',6), ('ship:viking',6), ('ship:ice',7), ('ship:steam',8), ('ship:pirate',10), ('ship:ghost',11), ('ship:golden',14), ('bskin:stone',120), ('bskin:mush',150), ('bskin:frost',190), ('bskin:crystal',240), ('bskin:coral',210), ('bskin:obsidian',280), ('bskin:neon',300), ('bskin:golden',320), ('tskin:moss',100), ('tskin:mail',140), ('tskin:shadow',170), ('tskin:royal',190), ('tskin:jade',220), ('tskin:golden',240), ('rskin:cobble',110), ('rskin:moss',140), ('rskin:ice',200), ('rskin:gold',230), ('rskin:lava',260), ('rskin:neon',280), ('hat:cap',2), ('hat:beanie',2), ('hat:flower',2), ('hat:party',2), ('hat:helmet',3), ('hat:top',3), ('hat:pirate',3), ('hat:mushroom',3), ('hat:wizard',4), ('hat:cowboy',4), ('hat:chef',4), ('hat:miner',4), ('hat:viking',5), ('hat:headphones',5), ('hat:crown',5), ('hat:halo',6), ('hat:santa',6), ('hat:astro',8), ('flag:de',1), ('flag:gb',1), ('flag:us',1), ('flag:fr',1), ('flag:es',1), ('flag:it',1), ('flag:nl',1), ('flag:pl',1), ('flag:pt',2), ('flag:br',2), ('flag:ar',2), ('flag:mx',2), ('flag:ca',2), ('flag:au',2), ('flag:jp',2), ('flag:kr',2), ('flag:cn',2), ('flag:in',2), ('flag:tr',2), ('flag:ru',2), ('flag:ua',2), ('flag:se',2), ('flag:no',2), ('flag:dk',2), ('flag:fi',2), ('flag:at',2), ('flag:ch',2), ('flag:ie',2), ('flag:be',2), ('flag:gr',2), ('flag:cz',2), ('flag:hu',2), ('flag:ro',2), ('flag:bg',2), ('flag:rs',2), ('flag:sk',2), ('flag:si',2), ('flag:il',2), ('flag:sa',2), ('flag:eg',2), ('flag:za',2), ('flag:bd',2), ('flag:mk',2), ('flag:a_red',2), ('flag:a_green',2), ('flag:a_gold',2), ('flag:a_stripe',2), ('flag:a_mound',3), ('flag:a_fungus',3), ('flag:a_swords',3), ('flag:a_queen',3)
on conflict (id) do update set price = excluded.price;
-- Quests sind reine Referenzdaten; abgeholte Quests stehen weiterhin im Profil.
delete from public.quests;
insert into public.quests(id,kind,stat,goal,reward) values
 ('d_games','daily','games',2,3), ('d_wins','daily','wins',1,8), ('d_conq','daily','conq',5,5), ('d_conq2','daily','conq',12,8), ('d_build','daily','built',8,6), ('d_build2','daily','built',20,9), ('d_terr','daily','terr',3,4), ('d_mins','daily','mins',10,4), ('d_found','daily','found',3,6), ('d_sunk','daily','sunk',1,7), ('d_allied','daily','allied',1,6), ('d_score','daily','score',500,7), ('b_daily','daily','bonus',12,6), ('w_games','weekly','games',5,10), ('w_wins','weekly','wins',1,14), ('w_days','weekly','days',3,14), ('w_conq','weekly','conq',10,12), ('w_conq2','weekly','conq',25,18), ('w_build','weekly','built',40,14), ('w_build2','weekly','built',80,18), ('w_sunk','weekly','sunk',3,16), ('w_sunk2','weekly','sunk',8,18), ('w_terr','weekly','terr',15,14), ('w_terr2','weekly','terr',25,16), ('w_found','weekly','found',10,14), ('w_found2','weekly','found',25,16), ('w_allied','weekly','allied',1,12), ('w_allied2','weekly','allied',2,16), ('w_mins','weekly','mins',120,14), ('w_score','weekly','score',3000,18), ('b_weekly','weekly','bonus',17,16), ('c_games_1','career','games',5,10), ('c_games_2','career','games',15,20), ('c_games_3','career','games',40,40), ('c_games_4','career','games',100,80), ('c_games_5','career','games',250,160), ('c_games2_1','career','games',20,15), ('c_games2_2','career','games',60,35), ('c_games2_3','career','games',150,80), ('c_games2_4','career','games',400,180), ('c_games3_1','career','games',50,40), ('c_games3_2','career','games',200,90), ('c_games3_3','career','games',500,200), ('c_games3_4','career','games',1200,420), ('c_days_1','career','days',3,10), ('c_days_2','career','days',7,25), ('c_days_3','career','days',20,60), ('c_days_4','career','days',50,130), ('c_days2_1','career','days',10,20), ('c_days2_2','career','days',25,50), ('c_days2_3','career','days',60,110), ('c_days2_4','career','days',120,230), ('c_mins_1','career','mins',30,8), ('c_mins_2','career','mins',120,20), ('c_mins_3','career','mins',480,55), ('c_mins_4','career','mins',1500,130), ('c_mins2_1','career','mins',60,15), ('c_mins2_2','career','mins',240,40), ('c_mins2_3','career','mins',900,95), ('c_mins2_4','career','mins',3000,210), ('c_wins_1','career','wins',1,12), ('c_wins_2','career','wins',5,25), ('c_wins_3','career','wins',15,50), ('c_wins_4','career','wins',40,100), ('c_wins_5','career','wins',100,200), ('c_wins2_1','career','wins',3,20), ('c_wins2_2','career','wins',10,45), ('c_wins2_3','career','wins',25,100), ('c_wins2_4','career','wins',60,220), ('c_wins3_1','career','wins',8,35), ('c_wins3_2','career','wins',20,80), ('c_wins3_3','career','wins',50,180), ('c_wins3_4','career','wins',120,380), ('c_wins4_1','career','wins',50,120), ('c_wins4_2','career','wins',150,260), ('c_wins4_3','career','wins',350,520), ('c_wins4_4','career','wins',800,900), ('c_conq_1','career','conq',10,12), ('c_conq_2','career','conq',50,30), ('c_conq_3','career','conq',150,70), ('c_conq_4','career','conq',400,140), ('c_conq2_1','career','conq',25,20), ('c_conq2_2','career','conq',100,50), ('c_conq2_3','career','conq',250,120), ('c_conq2_4','career','conq',600,260), ('c_conq3_1','career','conq',60,40), ('c_conq3_2','career','conq',200,95), ('c_conq3_3','career','conq',500,210), ('c_conq3_4','career','conq',1200,430), ('c_conq4_1','career','conq',150,90), ('c_conq4_2','career','conq',500,200), ('c_conq4_3','career','conq',1200,420), ('c_conq4_4','career','conq',3000,800), ('c_built_1','career','built',10,10), ('c_built_2','career','built',50,25), ('c_built_3','career','built',150,60), ('c_built_4','career','built',400,120), ('c_built2_1','career','built',25,18), ('c_built2_2','career','built',100,45), ('c_built2_3','career','built',250,110), ('c_built2_4','career','built',600,240), ('c_built3_1','career','built',60,38), ('c_built3_2','career','built',200,90), ('c_built3_3','career','built',500,200), ('c_built3_4','career','built',1200,410), ('c_built4_1','career','built',150,85), ('c_built4_2','career','built',500,190), ('c_built4_3','career','built',1200,400), ('c_built4_4','career','built',3000,780), ('c_sunk_1','career','sunk',1,15), ('c_sunk_2','career','sunk',5,35), ('c_sunk_3','career','sunk',15,80), ('c_sunk_4','career','sunk',40,160), ('c_sunk2_1','career','sunk',3,22), ('c_sunk2_2','career','sunk',8,50), ('c_sunk2_3','career','sunk',20,120), ('c_sunk2_4','career','sunk',50,260), ('c_sunk3_1','career','sunk',6,45), ('c_sunk3_2','career','sunk',15,110), ('c_sunk3_3','career','sunk',35,240), ('c_sunk3_4','career','sunk',80,500), ('c_sunk4_1','career','sunk',12,90), ('c_sunk4_2','career','sunk',30,200), ('c_sunk4_3','career','sunk',70,420), ('c_sunk4_4','career','sunk',160,820), ('c_allied_1','career','allied',1,8), ('c_allied_2','career','allied',5,25), ('c_allied_3','career','allied',15,60), ('c_allied_4','career','allied',30,130), ('c_allied2_1','career','allied',2,16), ('c_allied2_2','career','allied',8,45), ('c_allied2_3','career','allied',20,110), ('c_allied2_4','career','allied',40,230), ('c_allied3_1','career','allied',4,30), ('c_allied3_2','career','allied',12,75), ('c_allied3_3','career','allied',25,170), ('c_allied3_4','career','allied',50,350), ('c_allied4_1','career','allied',6,55), ('c_allied4_2','career','allied',15,130), ('c_allied4_3','career','allied',35,280), ('c_allied4_4','career','allied',70,560), ('c_found_1','career','found',5,8), ('c_found_2','career','found',25,20), ('c_found_3','career','found',75,50), ('c_found_4','career','found',200,110), ('c_found2_1','career','found',10,14), ('c_found2_2','career','found',50,40), ('c_found2_3','career','found',150,95), ('c_found2_4','career','found',400,210), ('c_found3_1','career','found',20,30), ('c_found3_2','career','found',80,80), ('c_found3_3','career','found',250,190), ('c_found3_4','career','found',600,400), ('c_found4_1','career','found',40,60), ('c_found4_2','career','found',150,150), ('c_found4_3','career','found',450,340), ('c_found4_4','career','found',1000,700), ('c_terr_1','career','terr',5,8), ('c_terr_2','career','terr',10,20), ('c_terr_3','career','terr',20,50), ('c_terr_4','career','terr',35,110), ('c_terr2_1','career','terr',12,18), ('c_terr2_2','career','terr',25,45), ('c_terr2_3','career','terr',45,100), ('c_terr2_4','career','terr',70,220), ('c_terr3_1','career','terr',18,35), ('c_terr3_2','career','terr',35,90), ('c_terr3_3','career','terr',55,190), ('c_terr3_4','career','terr',80,380), ('c_score_1','career','score',300,10), ('c_score_2','career','score',1000,30), ('c_score_3','career','score',3000,80), ('c_score_4','career','score',8000,180), ('c_score2_1','career','score',1500,25), ('c_score2_2','career','score',5000,65), ('c_score2_3','career','score',12000,150), ('c_score2_4','career','score',25000,340), ('c_score3_1','career','score',2500,40), ('c_score3_2','career','score',8000,110), ('c_score3_3','career','score',20000,240), ('c_score3_4','career','score',45000,520);

-- News v21.4
insert into public.news (version, title, body)
select 'v21.4', 'Wege wieder auf dem kürzesten Weg', 'Die automatischen Wege zwischen deinen Städten laufen wieder auf dem kürzesten Weg. Ein Fehler beim Glätten der Route hat jeden Weg pro Schritt um ein Drittel gestreckt, deshalb zogen sich die Verbindungen in riesigen Bögen über die Karte, statt Nachbargebiete direkt zu verbinden.'
where not exists (select 1 from public.news where version = 'v21.4');

-- News v21.3
insert into public.news (version, title, body)
select 'v21.3', '37 Karriere-Quests', 'Die Karriere ist noch einmal deutlich gewachsen: aus 20 sind 37 Quests geworden, jede mit vier bis fünf Stufen. Neue Linien wie Spielmarathon, Ausdauer, Champion, Feldzug, Imperium, Stadtplaner, Metropole, Admiral, Flottenherr, Botschafter, Friedensstifter, Sammler, Archäologe, Kontinent und Mythos geben auch langjährigen Spielern noch Ziele. Tages- und Wochenquests bleiben unverändert.'
where not exists (select 1 from public.news where version = 'v21.3');

-- News v21.2
insert into public.news (version, title, body)
select 'v21.2', 'Karriere mit 20 Quests', 'Die Karriere ist neu aufgeteilt: statt einiger langer Linien gibt es jetzt zwanzig Karriere-Quests mit je vier bis fünf Stufen – vom Vielspieler über den Belagerer bis zur Legende. Jede Karte zeigt ihre Stufen als nummerierte Punkte, den aktuellen Stand und die Belohnung. Tages- und Wochenquests bleiben unverändert. Der GitHub-Pages-Build ist repariert, die Änderungen sind wieder online.'
where not exists (select 1 from public.news where version = 'v21.2');

-- News v21.1
insert into public.news (version, title, body)
select 'v21.1', 'Mehr Tages- und Wochenquests', 'Die Erfolge sind jetzt deutlich voller: zwölf Tagesquests und siebzehn Wochenquests warten auf dich, jede mit eigenem Symbol, eigener Farbe und eigener Belohnung. Die Karriere bleibt bei 44 Stufen in elf Linien – dafür ist die Liste aufgeräumt: Symbol, Aufgabe und Abholen-Knopf stehen in einer Reihe, der Balken zeigt direkt darunter den Stand. Abholbereite Quests leuchten in ihrer Farbe, abgeholte sind klar als erledigt markiert.'
where not exists (select 1 from public.news where version = 'v21.1');

-- News v21
insert into public.news (version, title, body)
select 'v21', 'Liquid Glass, neue Skins und mehr Quests', 'Die Oberfläche und das Hauptmenü sind jetzt aus flüssigem Glas: weiche Spiegelungen, tiefe Unschärfe und Farbverläufe, die sich über die Karten legen. Alle Kosmetik ist neu gezeichnet: 18 Hüte, 12 Kronen und 10 Schiffe als detaillierte SVG-Dateien, dazu neue Muster, Gebäude-, Händler- und Wege-Skins – die Preise passen zur neuen Qualität. Die Erfolge sind überarbeitet: Fortschrittsbalken in der Farbe der Quest, große Abholen-Knöpfe, klare Abgeholt-Markierung und ein Prozentwert, der den echten Stand zeigt. Die Karriere bleibt bei 44 Stufen, dafür gibt es jetzt 12 Tages- und 17 Wochenquests.'
where not exists (select 1 from public.news where version = 'v21');
-- ============ Forum: Bugs, Vorschläge und Spieler-Reports (v21.5) ============
-- Jeder Spieler schreibt Meldungen. Lesen darf sie nur das Team – und der Verfasser seine eigene.
create table if not exists public.forum_threads(
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug','idea','report')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 4000),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index if not exists forum_threads_author on public.forum_threads (author, created_at desc);
create table if not exists public.forum_posts(
  id uuid primary key default gen_random_uuid(),
  thread uuid not null references public.forum_threads(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists forum_posts_thread on public.forum_posts (thread, created_at);
alter table public.forum_threads enable row level security;
alter table public.forum_posts   enable row level security;

-- Meldungen: Verfasser sieht nur seine eigene, Admin alle. Schreiben nur als man selbst.
drop policy if exists forum_t_read on public.forum_threads;
create policy forum_t_read  on public.forum_threads for select to authenticated using (author = auth.uid() or public.is_admin());
drop policy if exists forum_t_ins on public.forum_threads;
create policy forum_t_ins   on public.forum_threads for insert to authenticated with check (author = auth.uid());
drop policy if exists forum_t_admin on public.forum_threads;
create policy forum_t_admin on public.forum_threads for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Antworten: nur Admin oder der Verfasser des Beitrags.
drop policy if exists forum_p_read on public.forum_posts;
create policy forum_p_read  on public.forum_posts for select to authenticated using (public.is_admin() or exists (select 1 from public.forum_threads t where t.id = forum_posts.thread and t.author = auth.uid()));
drop policy if exists forum_p_ins on public.forum_posts;
create policy forum_p_ins   on public.forum_posts for insert to authenticated with check (author = auth.uid() and (public.is_admin() or exists (select 1 from public.forum_threads t where t.id = forum_posts.thread and t.author = auth.uid())));
drop policy if exists forum_p_admin on public.forum_posts;
create policy forum_p_admin on public.forum_posts for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Liste: Admin alle Meldungen, sonst nur die eigenen
create or replace function public.forum_list() returns table(id uuid, kind text, title text, body text, status text, created_at timestamptz, last_at timestamptz, author_name text, author_tag text, replies int, mine boolean)
language sql security definer set search_path=public stable as $$
  select t.id, t.kind, t.title, t.body, t.status, t.created_at,
         greatest(t.created_at, coalesce((select max(p.created_at) from public.forum_posts p where p.thread = t.id), t.created_at)) as last_at,
         pr.username, pr.tag,
         (select count(*)::int from public.forum_posts p where p.thread = t.id) as replies,
         t.author = auth.uid() as mine
  from public.forum_threads t join public.profiles pr on pr.id = t.author
  where auth.uid() is not null and (t.author = auth.uid() or public.is_admin())
  order by last_at desc limit 200
$$;

-- Verlauf einer Meldung (Admin oder Verfasser)
create or replace function public.forum_open(tid uuid) returns table(id uuid, body text, created_at timestamptz, author_name text, author_tag text, is_admin boolean, mine boolean)
language sql security definer set search_path=public stable as $$
  select p.id, p.body, p.created_at, pr.username, pr.tag, coalesce(pr.is_admin, false), p.author = auth.uid()
  from public.forum_posts p join public.profiles pr on pr.id = p.author
  where auth.uid() is not null and p.thread = tid
    and (public.is_admin() or exists (select 1 from public.forum_threads t where t.id = tid and t.author = auth.uid()))
  order by p.created_at
$$;

-- Meldung senden (höchstens 8 pro Tag und Spieler)
create or replace function public.forum_send(k text, t text, b text) returns uuid
language plpgsql security definer set search_path=public as $$
declare tt text; bb text; n int; newid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if k not in ('bug','idea','report') then raise exception 'Unbekannte Art'; end if;
  tt := left(trim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g')), 120);
  bb := left(trim(coalesce(b,'')), 4000);
  if char_length(tt) < 3 then raise exception 'Titel zu kurz'; end if;
  if char_length(bb) < 3 then raise exception 'Text zu kurz'; end if;
  select count(*) into n from public.forum_threads where author = auth.uid() and created_at > now() - interval '1 day';
  if n >= 8 then raise exception 'Zu viele Meldungen – bitte morgen wieder'; end if;
  insert into public.forum_threads(author, kind, title, body) values (auth.uid(), k, tt, bb) returning id into newid;
  return newid;
end $$;

-- Antwort oder Rückfrage: Admin immer, Verfasser solange offen
create or replace function public.forum_reply(tid uuid, b text) returns void
language plpgsql security definer set search_path=public as $$
declare th public.forum_threads; bb text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into th from public.forum_threads where id = tid;
  if th.id is null then raise exception 'Beitrag nicht gefunden'; end if;
  if not (public.is_admin() or th.author = auth.uid()) then raise exception 'Keine Berechtigung'; end if;
  if th.status = 'closed' and not public.is_admin() then raise exception 'Beitrag ist geschlossen'; end if;
  bb := left(trim(coalesce(b,'')), 2000);
  if char_length(bb) < 1 then raise exception 'Text fehlt'; end if;
  insert into public.forum_posts(thread, author, body) values (tid, auth.uid(), bb);
end $$;

-- Schließen und Löschen nur für Admins
create or replace function public.forum_close(tid uuid, c boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung'; end if;
  update public.forum_threads set status = case when c then 'closed' else 'open' end where id = tid;
end $$;
create or replace function public.forum_remove(tid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung'; end if;
  delete from public.forum_threads where id = tid;
end $$;

revoke all on function public.forum_list(), public.forum_open(uuid), public.forum_send(text,text,text), public.forum_reply(uuid,text), public.forum_close(uuid,boolean), public.forum_remove(uuid) from public, anon;
grant execute on function public.forum_list(), public.forum_open(uuid), public.forum_send(text,text,text), public.forum_reply(uuid,text), public.forum_close(uuid,boolean), public.forum_remove(uuid) to authenticated;

-- News v21.5
insert into public.news (version, title, body)
select 'v21.5', 'Forum für Bugs, Vorschläge und Spieler-Reports', 'Im Menü gibt es jetzt ein Forum. Melde dort Fehler, schreibe Vorschläge oder erstatte einen Spieler-Report – mit Name#Tag, Zeit und Beschreibung. Nur das Team kann alle Meldungen lesen und Rückfragen stellen; deine eigene Meldung und die Antworten darauf siehst du weiterhin selbst, niemand sonst.'
where not exists (select 1 from public.news where version = 'v21.5');
-- ============ Clans (v21.6) ============
-- Ein Clan hat Name, festen Tag, Tagfarbe, Beschreibung, offen/geschlossen und Mindest-Siege.
create table if not exists public.clans(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 28),
  tag text not null check (tag ~ '^[A-Z0-9]{2,5}$'),
  tag_color text not null default '#ffd166' check (tag_color ~ '^#[0-9A-Fa-f]{6}$'),
  descr text not null default '' check (char_length(descr) <= 600),
  logo text check (logo is null or (length(logo) <= 40000 and logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
  is_open boolean not null default true,
  min_wins int not null default 0 check (min_wins >= 0),
  max_members int not null default 50 check (max_members between 2 and 100),
  owner uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists clans_tag_uq  on public.clans (upper(tag));
create unique index if not exists clans_name_uq on public.clans (lower(name));

create table if not exists public.clan_members(
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (clan_id, user_id)
);
create unique index if not exists clan_members_one on public.clan_members (user_id);

create table if not exists public.clan_invites(
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'invite' check (kind in ('invite','apply')),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists clan_invites_uq on public.clan_invites (clan_id, user_id, kind) where status = 'pending';

create table if not exists public.clan_messages(
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  author uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists clan_messages_idx on public.clan_messages (clan_id, created_at desc);

alter table public.profiles add column if not exists clan_id uuid;
-- Clan-Logo (v21.7): nur PNG/JPG/WebP als Data-URL, hoechstens 40 kB
alter table public.clans add column if not exists logo text;
do $$ begin alter table public.clans add constraint clans_logo_chk check (logo is null or (length(logo) <= 40000 and logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')); exception when duplicate_object then null; end $$;

alter table public.clans         enable row level security;
alter table public.clan_members  enable row level security;
alter table public.clan_invites  enable row level security;
alter table public.clan_messages enable row level security;

drop policy if exists clans_read on public.clans;
create policy clans_read  on public.clans for select to authenticated using (true);
drop policy if exists clans_admin on public.clans;
create policy clans_admin on public.clans for all    to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists clan_members_read on public.clan_members;
create policy clan_members_read on public.clan_members for select to authenticated using (true);
drop policy if exists clan_msg_read on public.clan_messages;
create policy clan_msg_read on public.clan_messages for select to authenticated using (exists (select 1 from public.clan_members m where m.clan_id = clan_messages.clan_id and m.user_id = auth.uid()));
drop policy if exists clan_msg_ins on public.clan_messages;
create policy clan_msg_ins  on public.clan_messages for insert to authenticated with check (author = auth.uid() and exists (select 1 from public.clan_members m where m.clan_id = clan_messages.clan_id and m.user_id = auth.uid() and not m.muted));
drop policy if exists clan_inv_read on public.clan_invites;
create policy clan_inv_read on public.clan_invites for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.clan_members m where m.clan_id = clan_invites.clan_id and m.user_id = auth.uid() and m.role in ('owner','admin')));

-- Mein Clan mit Rolle und Summen (null, wenn ich in keinem Clan bin)
create or replace function public.clan_my() returns jsonb
language plpgsql security definer set search_path=public stable as $$
declare m public.clan_members; c public.clans; n int; w int; g int; ww int;
begin
  if auth.uid() is null then return null; end if;
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null then return null; end if;
  select * into c from public.clans where id = m.clan_id;
  if c.id is null then return null; end if;
  select count(*)::int, coalesce(sum(p.wins),0)::int, coalesce(sum(p.games),0)::int,
         coalesce(sum(coalesce((p.stats->'weekly'->'v'->>'wins')::int,0)),0)::int
    into n,w,g,ww
    from public.clan_members cm join public.profiles p on p.id = cm.user_id where cm.clan_id = c.id;
  return jsonb_build_object('clan', to_jsonb(c) || jsonb_build_object('members',n,'wins',w,'games',g,'week_wins',ww), 'role', m.role, 'muted', m.muted);
end $$;

-- Suche / Rangliste: alle Clans mit Mitgliederzahl, Siegen und Siegen dieser Woche
drop function if exists public.clan_find(text,text);
create or replace function public.clan_find(q text default '', mode text default 'all')
returns table(id uuid, name text, tag text, tag_color text, logo text, descr text, is_open boolean, min_wins int, max_members int, members int, wins int, games int, week_wins int, mine boolean, joined boolean, pending boolean)
language sql security definer set search_path=public stable as $$
  select c.id, c.name, c.tag, c.tag_color, c.logo, c.descr, c.is_open, c.min_wins, c.max_members,
    (select count(*)::int from public.clan_members m where m.clan_id = c.id) as members,
    coalesce((select sum(p.wins)::int from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id),0) as wins,
    coalesce((select sum(p.games)::int from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id),0) as games,
    coalesce((select sum(coalesce((p.stats->'weekly'->'v'->>'wins')::int,0))::int from public.clan_members m join public.profiles p on p.id = m.user_id where m.clan_id = c.id),0) as week_wins,
    c.owner = auth.uid() as mine,
    exists (select 1 from public.clan_members m where m.clan_id = c.id and m.user_id = auth.uid()) as joined,
    exists (select 1 from public.clan_invites i where i.clan_id = c.id and i.user_id = auth.uid() and i.status = 'pending') as pending
  from public.clans c
  where auth.uid() is not null
    and (coalesce(q,'') = '' or c.name ilike '%'||q||'%' or c.tag ilike '%'||q||'%')
    and (mode <> 'open' or c.is_open) and (mode <> 'closed' or not c.is_open)
  order by wins desc, c.created_at
  limit 100
$$;

-- Clan gründen: kostet 600 Rubys, Tag wird hier fest vergeben (v21.7: Logo optional)
drop function if exists public.clan_create(text,text,text,text,boolean,int);
create or replace function public.clan_create(n text, t text, color text, d text, op boolean, mw int default 0, logo text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare me public.profiles; nm text; tg text; col text; newid uuid; cost int := 600; lg text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.clan_members where user_id = auth.uid()) then raise exception 'Du bist schon in einem Clan'; end if;
  nm := left(trim(regexp_replace(coalesce(n,''), '\s+', ' ', 'g')), 28);
  tg := upper(regexp_replace(coalesce(t,''), '[^A-Za-z0-9]', '', 'g'));
  col := lower(coalesce(nullif(color,''), '#ffd166'));
  if char_length(nm) < 3 then raise exception 'Name zu kurz (3–28 Zeichen)'; end if;
  if char_length(tg) < 2 then raise exception 'Tag zu kurz (2–5 Zeichen)'; end if;
  if col !~ '^#[0-9a-f]{6}$' then col := '#ffd166'; end if;
  lg := nullif(logo,'');
  if lg is not null and (length(lg) > 40000 or lg !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Logo ungültig (nur PNG, JPG oder WebP bis 40 kB)'; end if;
  if exists (select 1 from public.clans where upper(tag) = tg) then raise exception 'Tag ist schon vergeben'; end if;
  if exists (select 1 from public.clans where lower(name) = lower(nm)) then raise exception 'Name ist schon vergeben'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if me.rubys < cost then raise exception 'Nicht genug Rubys (600 nötig)'; end if;
  insert into public.clans(name, tag, tag_color, descr, logo, is_open, min_wins, owner)
    values (nm, tg, col, left(coalesce(d,''),600), lg, coalesce(op,true), greatest(0, coalesce(mw,0)), auth.uid())
    returning id into newid;
  insert into public.clan_members(clan_id, user_id, role) values (newid, auth.uid(), 'owner');
  perform set_config('app.rpc','1',true);
  update public.profiles set rubys = rubys - cost, clan_id = newid, clan_tag = tg where id = auth.uid();
  return newid;
end $$;

-- Name, Beschreibung, Farbe, Logo, offen/geschlossen, Mindest-Siege ändern (Besitzer und Admins)
drop function if exists public.clan_update(text,text,text,boolean,int);
create or replace function public.clan_update(n text, d text, color text, op boolean, mw int default 0, logo text default null) returns void
language plpgsql security definer set search_path=public as $$
declare m public.clan_members; nm text; col text; lg text;
begin
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null or m.role not in ('owner','admin') then raise exception 'Keine Berechtigung'; end if;
  nm := left(trim(regexp_replace(coalesce(n,''), '\s+', ' ', 'g')), 28);
  col := lower(coalesce(nullif(color,''), '#ffd166'));
  if char_length(nm) < 3 then raise exception 'Name zu kurz (3–28 Zeichen)'; end if;
  if col !~ '^#[0-9a-f]{6}$' then col := '#ffd166'; end if;
  lg := nullif(logo,'');
  if lg is not null and (length(lg) > 40000 or lg !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Logo ungültig (nur PNG, JPG oder WebP bis 40 kB)'; end if;
  if exists (select 1 from public.clans where lower(name) = lower(nm) and id <> m.clan_id) then raise exception 'Name ist schon vergeben'; end if;
  update public.clans set name = nm, descr = left(coalesce(d,''),600), tag_color = col, logo = lg,
    is_open = coalesce(op, is_open), min_wins = greatest(0, coalesce(mw,0)) where id = m.clan_id;
end $$;

create or replace function public.clan_members()
returns table(user_id uuid, username text, tag text, avatar text, role text, muted boolean, wins int, games int, joined_at timestamptz, last_seen timestamptz)
language sql security definer set search_path=public stable as $$
  select m.user_id, p.username, p.tag, p.avatar, m.role, m.muted, p.wins, p.games, m.joined_at, m.last_seen
  from public.clan_members m join public.profiles p on p.id = m.user_id
  where m.clan_id = (select clan_id from public.clan_members where user_id = auth.uid())
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.wins desc
$$;

create or replace function public.clan_chat()
returns table(id uuid, user_id uuid, username text, tag text, body text, created_at timestamptz, role text)
language sql security definer set search_path=public stable as $$
  select m.id, m.author, p.username, p.tag, m.body, m.created_at, coalesce(cm.role,'member')
  from public.clan_messages m
    join public.profiles p on p.id = m.author
    left join public.clan_members cm on cm.clan_id = m.clan_id and cm.user_id = m.author
  where m.clan_id = (select clan_id from public.clan_members where user_id = auth.uid())
  order by m.created_at desc limit 80
$$;

create or replace function public.clan_say(b text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.clan_members; bb text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null then raise exception 'Du bist in keinem Clan'; end if;
  if m.muted then raise exception 'Du bist stummgeschaltet'; end if;
  bb := left(trim(coalesce(b,'')), 500);
  if char_length(bb) < 1 then raise exception 'Nachricht fehlt'; end if;
  insert into public.clan_messages(clan_id, author, body) values (m.clan_id, auth.uid(), bb);
end $$;

create or replace function public.clan_join(cid uuid) returns void
language plpgsql security definer set search_path=public as $$
declare c public.clans; me public.profiles; n int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.clan_members where user_id = auth.uid()) then raise exception 'Du bist schon in einem Clan'; end if;
  select * into c from public.clans where id = cid;
  if c.id is null then raise exception 'Clan nicht gefunden'; end if;
  if not c.is_open and not exists (select 1 from public.clan_invites where clan_id = cid and user_id = auth.uid() and status = 'pending') then
    raise exception 'Clan ist geschlossen – schick eine Anfrage'; end if;
  select count(*) into n from public.clan_members where clan_id = cid;
  if n >= c.max_members then raise exception 'Clan ist voll'; end if;
  select * into me from public.profiles where id = auth.uid();
  if coalesce(me.wins,0) < c.min_wins then raise exception 'Noch % Siege nötig', c.min_wins - coalesce(me.wins,0); end if;
  insert into public.clan_members(clan_id, user_id) values (cid, auth.uid());
  update public.clan_invites set status = 'accepted' where clan_id = cid and user_id = auth.uid() and status = 'pending';
  perform set_config('app.rpc','1',true);
  update public.profiles set clan_id = cid, clan_tag = c.tag where id = auth.uid();
end $$;

create or replace function public.clan_apply(cid uuid) returns void
language plpgsql security definer set search_path=public as $$
declare c public.clans;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists (select 1 from public.clan_members where user_id = auth.uid()) then raise exception 'Du bist schon in einem Clan'; end if;
  select * into c from public.clans where id = cid;
  if c.id is null then raise exception 'Clan nicht gefunden'; end if;
  if c.is_open then perform public.clan_join(cid); return; end if;
  if not exists (select 1 from public.clan_invites where clan_id = cid and user_id = auth.uid() and status = 'pending') then
    insert into public.clan_invites(clan_id, user_id, kind, by) values (cid, auth.uid(), 'apply', auth.uid());
  end if;
end $$;

create or replace function public.clan_invite(n text, tg text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.clan_members; c public.clans; tgt public.profiles; cnt int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null or m.role not in ('owner','admin') then raise exception 'Keine Berechtigung'; end if;
  select * into c from public.clans where id = m.clan_id;
  select * into tgt from public.profiles where lower(username) = lower(trim(coalesce(n,''))) and tag = coalesce(tg,'');
  if tgt.id is null then raise exception 'Spieler nicht gefunden (Name#1234)'; end if;
  if exists (select 1 from public.clan_members where user_id = tgt.id) then raise exception 'Spieler ist schon in einem Clan'; end if;
  select count(*) into cnt from public.clan_members where clan_id = c.id;
  if cnt >= c.max_members then raise exception 'Clan ist voll'; end if;
  if not exists (select 1 from public.clan_invites where clan_id = c.id and user_id = tgt.id and status = 'pending') then
    insert into public.clan_invites(clan_id, user_id, kind, by) values (c.id, tgt.id, 'invite', auth.uid());
  end if;
end $$;

drop function if exists public.clan_invites();
create or replace function public.clan_invites()
returns table(id uuid, kind text, clan_id uuid, clan_name text, clan_tag text, tag_color text, logo text, username text, tag text, created_at timestamptz, outgoing boolean)
language sql security definer set search_path=public stable as $$
  select i.id, i.kind, c.id, c.name, c.tag, c.tag_color, c.logo, p.username, p.tag, i.created_at, (i.user_id <> auth.uid())
  from public.clan_invites i
    join public.clans c on c.id = i.clan_id
    join public.profiles p on p.id = i.user_id
  where i.status = 'pending' and auth.uid() is not null
    and (i.user_id = auth.uid() or i.by = auth.uid()
      or exists (select 1 from public.clan_members m where m.clan_id = i.clan_id and m.user_id = auth.uid() and m.role in ('owner','admin')))
  order by i.created_at desc limit 60
$$;

create or replace function public.clan_invite_respond(iid uuid, acc boolean) returns void
language plpgsql security definer set search_path=public as $$
declare i public.clan_invites; m public.clan_members; c public.clans; n int;
begin
  select * into i from public.clan_invites where id = iid and status = 'pending';
  if i.id is null then raise exception 'Einladung nicht gefunden'; end if;
  if i.kind = 'invite' then
    if i.user_id <> auth.uid() then raise exception 'Keine Berechtigung'; end if;
    if acc then perform public.clan_join(i.clan_id); end if;
  else
    select * into m from public.clan_members where clan_id = i.clan_id and user_id = auth.uid();
    if m.clan_id is null or m.role not in ('owner','admin') then raise exception 'Keine Berechtigung'; end if;
    if acc then
      select * into c from public.clans where id = i.clan_id;
      select count(*) into n from public.clan_members where clan_id = c.id;
      if n >= c.max_members then raise exception 'Clan ist voll'; end if;
      if exists (select 1 from public.clan_members where user_id = i.user_id) then raise exception 'Spieler ist schon in einem Clan'; end if;
      insert into public.clan_members(clan_id, user_id) values (c.id, i.user_id);
      perform set_config('app.rpc','1',true);
      update public.profiles set clan_id = c.id, clan_tag = c.tag where id = i.user_id;
    end if;
  end if;
  update public.clan_invites set status = case when acc then 'accepted' else 'declined' end where id = i.id;
end $$;

-- Mitglied verwalten: mute, unmute, kick, admin, member, owner
create or replace function public.clan_member_act(uid uuid, act text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.clan_members; t public.clan_members;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null or m.role not in ('owner','admin') then raise exception 'Keine Berechtigung'; end if;
  if uid = auth.uid() then raise exception 'Das geht nicht mit dir selbst'; end if;
  select * into t from public.clan_members where clan_id = m.clan_id and user_id = uid;
  if t.user_id is null then raise exception 'Mitglied nicht gefunden'; end if;
  if t.role = 'owner' then raise exception 'Der Besitzer kann nicht geändert werden'; end if;
  if m.role = 'admin' and t.role = 'admin' then raise exception 'Nur der Besitzer verwaltet Admins'; end if;
  if act = 'mute' then update public.clan_members set muted = true  where clan_id = m.clan_id and user_id = uid;
  elsif act = 'unmute' then update public.clan_members set muted = false where clan_id = m.clan_id and user_id = uid;
  elsif act = 'kick' then
    delete from public.clan_members where clan_id = m.clan_id and user_id = uid;
    perform set_config('app.rpc','1',true);
    update public.profiles set clan_id = null, clan_tag = '' where id = uid;
  elsif act = 'admin' and m.role = 'owner' then update public.clan_members set role = 'admin'  where clan_id = m.clan_id and user_id = uid;
  elsif act = 'member' and m.role = 'owner' then update public.clan_members set role = 'member' where clan_id = m.clan_id and user_id = uid;
  elsif act = 'owner' and m.role = 'owner' then
    update public.clan_members set role = 'owner' where clan_id = m.clan_id and user_id = uid;
    update public.clan_members set role = 'admin' where clan_id = m.clan_id and user_id = auth.uid();
    update public.clans set owner = uid where id = m.clan_id;
  else raise exception 'Unbekannte Aktion'; end if;
end $$;

create or replace function public.clan_leave() returns void
language plpgsql security definer set search_path=public as $$
declare m public.clan_members; n int; nx uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null then raise exception 'Du bist in keinem Clan'; end if;
  perform set_config('app.rpc','1',true);
  if m.role = 'owner' then
    select count(*) into n from public.clan_members where clan_id = m.clan_id;
    if n <= 1 then
      delete from public.clans where id = m.clan_id;
    else
      select user_id into nx from public.clan_members
        where clan_id = m.clan_id and user_id <> auth.uid()
        order by case role when 'admin' then 0 else 1 end, joined_at limit 1;
      update public.clan_members set role = 'owner' where clan_id = m.clan_id and user_id = nx;
      update public.clans set owner = nx where id = m.clan_id;
      delete from public.clan_members where clan_id = m.clan_id and user_id = auth.uid();
    end if;
  else
    delete from public.clan_members where clan_id = m.clan_id and user_id = auth.uid();
  end if;
  update public.profiles set clan_id = null, clan_tag = '' where id = auth.uid();
end $$;

create or replace function public.clan_stats() returns jsonb
language plpgsql security definer set search_path=public stable as $$
declare m public.clan_members; c public.clans; n int; w int; g int; ww int; rk int; best jsonb; wr int;
begin
  if auth.uid() is null then return null; end if;
  select * into m from public.clan_members where user_id = auth.uid();
  if m.clan_id is null then return null; end if;
  select * into c from public.clans where id = m.clan_id;
  if c.id is null then return null; end if;
  select count(*)::int, coalesce(sum(p.wins),0)::int, coalesce(sum(p.games),0)::int,
         coalesce(sum(coalesce((p.stats->'weekly'->'v'->>'wins')::int,0)),0)::int,
         coalesce(jsonb_agg(jsonb_build_object('username',p.username,'tag',p.tag,'wins',p.wins,'week',coalesce((p.stats->'weekly'->'v'->>'wins')::int,0)) order by p.wins desc),'[]'::jsonb)
    into n,w,g,ww,best
    from public.clan_members cm join public.profiles p on p.id = cm.user_id where cm.clan_id = c.id;
  wr := case when g > 0 then round(100.0 * w / g) else 0 end;
  select count(*) + 1 into rk from (
    select c2.id, coalesce(sum(p2.wins),0) as w from public.clans c2
      left join public.clan_members m2 on m2.clan_id = c2.id
      left join public.profiles p2 on p2.id = m2.user_id
    group by c2.id) s where s.w > w;
  return jsonb_build_object('clan', to_jsonb(c) || jsonb_build_object('members',n,'wins',w,'games',g,'week_wins',ww,'winrate',wr),
    'rank', rk, 'best', best, 'role', m.role, 'muted', m.muted);
end $$;

create or replace function public.clan_touch() returns void
language sql security definer set search_path=public as $$
  update public.clan_members set last_seen = now() where user_id = auth.uid()
$$;

revoke all on function public.clan_my(), public.clan_find(text,text), public.clan_create(text,text,text,text,boolean,int,text), public.clan_update(text,text,text,boolean,int,text),
  public.clan_members(), public.clan_chat(), public.clan_say(text), public.clan_join(uuid), public.clan_apply(uuid), public.clan_invite(text,text),
  public.clan_invites(), public.clan_invite_respond(uuid,boolean), public.clan_member_act(uuid,text), public.clan_leave(), public.clan_stats(), public.clan_touch() from public, anon;
grant execute on function public.clan_my(), public.clan_find(text,text), public.clan_create(text,text,text,text,boolean,int,text), public.clan_update(text,text,text,boolean,int,text),
  public.clan_members(), public.clan_chat(), public.clan_say(text), public.clan_join(uuid), public.clan_apply(uuid), public.clan_invite(text,text),
  public.clan_invites(), public.clan_invite_respond(uuid,boolean), public.clan_member_act(uuid,text), public.clan_leave(), public.clan_stats(), public.clan_touch() to authenticated;

-- News v21.6
insert into public.news (version, title, body)
select 'v21.6', 'Clans neu, Erfolge als Karten und besseres Handy-Spiel', 'Clans sind jetzt echte Teams: eigene Seite mit Mitgliederliste (Rollen, Siege, zuletzt online), Clan-Chat mit Beitritts-Verlauf, Statistik mit Rang, Siegquote und besten Spielern sowie eine Suche mit offenen und geschlossenen Clans. Ohne Clan gründest du für 600 Rubys einen eigenen – Name, Tag, Tagfarbe, Beschreibung mit Markdown und klickbaren Discord-Links, offen oder auf Anfrage, Mindest-Siege und Einladungen. Der Tag wird bei der Gründung vergeben und ist nicht mehr frei wählbar. Clan-Besitzer und Admins können Mitglieder befördern, stummschalten und entfernen. Außerdem: der Forum-Knopf sitzt jetzt oben neben den News (jeder darf schreiben, auch Admins), die Sprachwahl liegt in den Einstellungen, abholbereite Quests leuchten beim Abholen auf, die Karriere zeigt sich als Kartenraster mit Kategorien, Symbolen, Stufen und Fortschritt – und auf dem Handy sind Knöpfe, Leisten und das Kreismenü deutlich besser zu treffen. PC und Tablet bleiben unverändert.'
where not exists (select 1 from public.news where version = 'v21.6');

-- News v21.7
insert into public.news (version, title, body)
select 'v21.7', 'Große Abholen-Taste, Clan-Logos und neues Menü', 'Die Erfolge haben jetzt den großen Abholen-Knopf: Sobald eine Stufe geschafft ist, füllt die orange Taste die ganze Karte – wie im Vorbild. Clans bekommen ein eigenes Logo: Bild wählen (nur PNG, JPG oder WebP, höchstens 4 MB), es wird quadratisch zugeschnitten und erscheint als Wappen in Clan-Karte, Chat, Statistik, Suche und Einladungen. Im Hauptmenü gibt es einen Schieberegler für die Anzahl der Gegner (1 bis 12) und die Modi sind jetzt Karten mit Namen, Tempo und Beschreibung. Die Werbefläche ist an den Glas-Hintergrund angepasst, und die Menüknöpfe stehen etwas höher, näher zur Mitte – zentriert ist nichts.'
where not exists (select 1 from public.news where version = 'v21.7');

-- News v21.8
insert into public.news (version, title, body)
select 'v21.8', 'Weniger Quests, Schwierigkeits-Regler und große News', 'Die täglichen und wöchentlichen Quests sind aufgeräumt: fünf Aufgaben pro Tag und vier pro Woche, der Bonus zählt genau diese. Auf der Karriere-Karte ist der Abholen-Bereich jetzt immer groß, auch wenn die Stufe noch läuft. Im Hauptmenü regelt ein Schieberegler die Schwierigkeit von Leicht bis Schwer – wie viele Gegner mitspielen, gibt der Modus vor. Die Modus-Karten tragen nur noch Name und Tempo, und der neueste News-Eintrag öffnet sich groß mit eigener Schrift. Im Shop ist der lange Erklärungstext weg.'
where not exists (select 1 from public.news where version = 'v21.8');

-- News v21.9
insert into public.news (version, title, body)
select 'v21.9', 'News wieder ganz aufgeklappt', 'Der neueste News-Eintrag wird jetzt vollständig angezeigt. Bisher stauchte der Menü-Bereich seinen Inhalt auf die Bildschirmhöhe zusammen, deshalb brach der Text am unteren Rand ab, ohne dass man weiterscrollen konnte. Jetzt behalten News, Panels und Listen ihre volle Höhe und der Bereich scrollt – es gibt kein Größenlimit mehr.'
where not exists (select 1 from public.news where version = 'v21.9');

-- News v21.10
insert into public.news (version, title, body)
select 'v21.10', 'Mehr Platz für den neuesten Release', 'Der neueste News-Eintrag nimmt sich jetzt deutlich mehr Raum: größere Überschrift, größerer Fließtext mit mehr Zeilenabstand, eine größere Initiale und großzügiger Innenabstand. Dadurch wirkt der aktuelle Release wie eine eigene Seite und läuft weiter nach unten aus, statt gedrängt über den älteren Einträgen zu stehen.'
where not exists (select 1 from public.news where version = 'v21.10');

-- News v21.11
insert into public.news (version, title, body)
select 'v21.11', 'Polierte Oberfläche: 404-Seite, Ladeanimation und Handy-Menü', 'Wer eine falsche Adresse aufruft, landet jetzt auf einer eigenen 404-Seite mit Ameisenrennen und einem Weg zurück ins Spiel. Beim Laden und beim Aufbau einer Kolonie läuft eine eigene Ladeanimation. Der Cookie-Hinweis ist auf das Nötigste geschrumpft – Akzeptieren, nur Nötiges oder Einstellungen – und lässt sich in den Einstellungen jederzeit wieder öffnen. Auf dem Handy klappt ein Menüknopf die Navigation als Schublade mit Beschriftungen auf, und eine neue Steuerleiste bietet Ansicht wechseln, Tunnelansicht und Zoom ohne Tastatur. Oben zeigt ein schmaler Balken den Scroll-Fortschritt, und im Anmeldeformular lässt sich das Passwort per Auge ein- und ausblenden.'
where not exists (select 1 from public.news where version = 'v21.11');

-- News v21.12
insert into public.news (version, title, body)
select 'v21.12', 'Rubys fliegen zur Anzeige', 'Beim Abholen einer Quest lösen sich die Rubys aus dem Abholen-Knopf und fliegen in einer kleinen Animation quer über den Bildschirm zur Rubys-Anzeige, die beim Ankommen kurz aufpoppt – bei Tages-, Wochen- und Karriere-Quests gleichermaßen. Im Shop funktioniert es genauso: Nach dem Kauf fliegt das gekaufte Symbol zur Anzeige. Die Karriere-Karten sind außerdem aufgeräumt: Die nummerierten Stufen 1 bis 5 sind weg, „Stufe 4 von 5“, der Prozentwert, der Fortschritt und der Abholen-Bereich bleiben.'
where not exists (select 1 from public.news where version = 'v21.12');

-- News v21.13
insert into public.news (version, title, body)
select 'v21.13', 'Vollbild, neue Kolonie und freies Bauen', 'Das Spiel nutzt jetzt den ganzen Bildschirm: Kopfzeile und Werbung verschwinden im Spiel, die Kolonie und die Weltkarte füllen die Fläche, und das Dock schwebt als Glasleiste über der Szene. Die Werbefläche rechts schwebt als Glasplatte über dem Hintergrund, ohne dunklen Rand dahinter, und die ganze Oberfläche ist durchgängig aus flüssigem Glas. Die Kolonie ist neu gezeichnet: Himmel mit Dithering und Wolken, Wald am Horizont, Erdrillen und Kiesel am Hügel, aufgewertete Tunnel und Kammern, größere Kartenbilder im Dock – und einzelne Ameisen sind deutlich kleiner. Ameisen drehen sich jetzt in jede Richtung mit, auch an Ecken. Außenposten baust du frei: bis zu drei je Gebiet, die Stelle wählst du per Klick, auch ohne vorher das Gebiet auszuwählen. Verteidigungslinien sind entfernt. Quests schreibst du nicht mehr ab – sie gelten automatisch als geschafft und zeigen nur noch eine Animation. Die Bestenliste sitzt oben links, unten links stehen FPS und die Schutzzeit. Clans können wieder Logos hochladen. Die Ameisenart wählst du über Karten mit Pixel-Vorschau und Werten, und der Menühintergrund zeigt keine schwarzen Linien mehr.'
where not exists (select 1 from public.news where version = 'v21.13');

-- News v21.14
insert into public.news (version, title, body)
select 'v21.14', 'Ameisenarten als Umschalter, Spiel-Leiste oben und Erfolge zum Wegklicken', 'Die Ameisenart wählst du jetzt in einer schlichten Umschaltleiste – ohne Vorschaubilder, nur die drei Namen, der aktive Eintrag hebt sich hell ab. Wer „Spielen“ drückt, wählt das Startgebiet im Vollbild: Kopfzeile und Werbung sind weg, die Karte füllt den ganzen Bildschirm. Im Spiel gibt es oben in der Mitte einen Umschalter zwischen Kolonie und Weltkarte; rechts daneben stehen Uhrzeit, Schutzzeit, Einstellungen und Verlassen – auch in der Kolonie. Der Quest-Knopf im Spiel ist entfernt: Geschaffte Erfolge erscheinen nur noch als kurze Meldung, die nach fünf Sekunden verschwindet oder sich mit einem Klick schließen lässt. Hüte sitzen jetzt auf dem Kopf und drehen sich mit der Laufrichtung der Ameisen. Der Bestenlisten-Knopf trägt das Symbol der Bestenliste selbst.'
where not exists (select 1 from public.news where version = 'v21.14');

-- News v21.15
insert into public.news (version, title, body)
select 'v21.15', 'Kompaktes Hauptmenü mit Kartenbild und neue Gegner-Stärke', 'Das Hauptmenü ist aufgeräumt: Oben sitzt eine kleinere Karte mit unverwaschenem Kartenbild, darunter stehen die vier Modi in einer Reihe – in derselben Größe wie die vier Knöpfe darunter. Die Ameisenart wählst du nicht mehr im Menü, sondern direkt beim Startgebiet: Die Wahl erscheint oben in der Leiste „Wähle dein Startgebiet“. Das Menü liegt jetzt oben rechts in der Ecke, der doppelte Profil-Knopf ist weg (dein Profil erreichst du oben rechts). Der Hintergrund bleibt fest stehen, er wechselt nicht mehr mit jeder neuen Karte. Knöpfe leuchten beim Überfahren in der Akzentfarbe auf. Gegner starten mit nur einem Gebiet und deutlich weniger Truppen: Leicht 75 %, Normal 100 %, Schwer 135 % deiner Starttruppen. Die Angriffs-Leiste auf der Weltkarte trägt jetzt ein Schwert.'
where not exists (select 1 from public.news where version = 'v21.15');

-- News v21.16
insert into public.news (version, title, body)
select 'v21.16', 'Profil, News und Forum ganz in der Ecke', 'Die Knöpfe für News, Forum und Profil sitzen jetzt wirklich in der rechten oberen Ecke des Fensters: Die Kopfzeile reicht bis zum rechten Rand, die Werbefläche bleibt darunter frei. Am Hauptmenü selbst ändert sich nichts – Karte, Modi und die vier Aktionsknöpfe bleiben, wo sie sind.'
where not exists (select 1 from public.news where version = 'v21.16');

-- News v21.17
insert into public.news (version, title, body)
select 'v21.17', 'Menü wieder links, Profil bleibt in der Ecke', 'Die Menüleiste mit Erfolge, Shop, Inventar, Freunde, Clan, Ranking und Einstellungen sitzt wieder links am Rand und reicht über die volle Höhe – mit Symbol und Beschriftung. Dadurch steht das Hauptmenü wieder mittig auf dem Bildschirm. Oben rechts in der Ecke bleiben News, Forum und Profil.'
where not exists (select 1 from public.news where version = 'v21.17');

-- News v21.18
insert into public.news (version, title, body)
select 'v21.18', 'Ganze Karte im Menü, Chaos und Unlimited schneller', 'Die Kartenvorschau im Hauptmenü zeigt jetzt die ganze Karte statt nur eines Ausschnitts: Das Bild ist höher, die ganze Karte ist vollständig zu sehen und die Ränder füllt dasselbe Kartenbild unscharf auf. Außerdem laufen Chaos mit Tempo 4x und Unlimited mit Tempo 3,5x.'
where not exists (select 1 from public.news where version = 'v21.18');

-- News v21.19
insert into public.news (version, title, body)
select 'v21.19', 'Mehr Wasser: Karten sind jetzt Inseln', 'Die Karten haben deutlich mehr Meer: Das Land nimmt nur noch etwa ein Drittel der Fläche ein (vorher gut 40 Prozent) und endet mit Abstand vor dem Kartenrand. Dadurch liegt der ganze Kontinent als Insel mit Küste ringsum im Wasser, Seen und Flüsse bleiben. Die Zahl der Gebiete bleibt bei rund 20, bei Unlimited bei rund 70.'
where not exists (select 1 from public.news where version = 'v21.19');

-- News v21.20
insert into public.news (version, title, body)
select 'v21.20', 'Kartenvorschau ohne Ränder', 'Im Hauptmenü füllt die Kartenvorschau jetzt die ganze Fläche: Links und rechts läuft das Meer im gleichen Zellenraster weiter, statt unscharfer Balken. Es ist kein Rand und keine Kante mehr an der Karte zu sehen, egal wie breit das Fenster ist.'
where not exists (select 1 from public.news where version = 'v21.20');

-- News v22
insert into public.news (version, title, body)
select 'v22', 'Kein Einfrieren, markierte Räume, Bestenliste an der Kopfzeile', 'Das Spiel friert nicht mehr ein: Ein Fehler in einem einzelnen Bild wird abgefangen, Simulation und Anzeige laufen weiter. Beim Bauen ist der gewählte Raum im Dock jetzt deutlich markiert – goldener Rahmen, helle Fläche und ein Häkchen. Die Bestenliste klappt man über ihre eigene Kopfzeile ein und aus; der kleine Knopf darüber ist weg, und eingeklappt bleibt die Kopfzeile sichtbar.'
where not exists (select 1 from public.news where version = 'v22');
-- ============ Update v23: AntWars +, Kosmetik-Stufen, mehr Quest-Rubys ============
-- Mitgliedschaft „AntWars +“: 900 Rubys für 30 Tage, verlängert sich vom bestehenden Ende aus.
alter table public.profiles add column if not exists plus_until timestamptz;

create or replace function public.buy_plus() returns timestamptz
language plpgsql security definer set search_path=public as $$
declare me public.profiles; nxt timestamptz;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'Profil fehlt'; end if;
  if me.rubys < 900 then raise exception 'Nicht genug Rubys'; end if;
  nxt := greatest(coalesce(me.plus_until, now()), now()) + interval '30 days';
  perform set_config('app.rpc','1',true);
  -- Die 16 AntWars+-Stücke wandern in „owned“, damit sie ausgerüstet werden dürfen (2 je Kosmetik-Art)
  update public.profiles set rubys = rubys - 900, plus_until = nxt,
    owned = (select array_agg(distinct x) from unnest(owned || array['hat:pharaoh','hat:nebula','crown:omega','crown:aurora','pattern:plus','pattern:aurora','ship:leviathan','ship:nebula','bskin:aurum','bskin:void','tskin:aurum','tskin:void','rskin:aurum','rskin:void','flag:p_plus','flag:p_aurum']) x)
  where id = auth.uid();
  return nxt;
end $$;
grant execute on function public.buy_plus() to authenticated;

-- Tages- und Wochenquests: mehr Rubys (Täglich 20–40, Bonus 100; Wöchentlich 50–100, Bonus 250).
-- Karriere-Quests bleiben unverändert.
delete from public.quests where kind in ('daily','weekly');
insert into public.quests(id,kind,stat,goal,reward) values
 ('d_games','daily','games',2,20),
 ('d_wins','daily','wins',1,25),
 ('d_conq','daily','conq',5,30),
 ('d_build','daily','built',8,35),
 ('d_mins','daily','mins',10,40),
 ('b_daily','daily','bonus',5,100),
 ('w_games','weekly','games',5,50),
 ('w_conq','weekly','conq',10,65),
 ('w_build','weekly','built',40,80),
 ('w_mins','weekly','mins',120,100),
 ('b_weekly','weekly','bonus',4,250)
on conflict (id) do update set kind=excluded.kind, stat=excluded.stat, goal=excluded.goal, reward=excluded.reward;

-- Die neuen AntWars+-Kosmetikstücke (Pharaonenkrone, Nebelkappe, Omega-Krone, Polarlicht-Krone,
-- Leviathan, Nebelgaleone, Plus-Muster, Polarlicht-Muster, Aurum-/Void-Skins, AntWars+-Flaggen)
-- haben keinen Preis und stehen deshalb absichtlich nicht in shop_items: Sie lassen sich nicht mit
-- Rubys kaufen, sondern nur mit einer aktiven Mitgliedschaft ausrüsten.

-- News v23
insert into public.news (version, title, body)
select 'v23', 'AntWars +, Stufen im Shop, freies Bauen und schnelle Kolonie', 'AntWars + ist da: für 900 Rubys im Monat bekommst du 16 exklusive Kosmetikstücke (zwei je Art), ein + vor dem Namen und den Clan-Tag hinter dem Namen. Die Kosmetik liegt im Shop im neuen Reiter „AntWars +“. Alle Kosmetik ist jetzt in Stufen sortiert – Gewöhnlich, Selten, Episch, Legendär, Mythisch – und die beliebtesten Stücke tragen ein Band. Der Shop ist neu: große Karten mit Stufenfarbe, ein Filter über den Stufen und eine Detailansicht mit großem Vorschaufenster und Preis. Fehlen Rubys, führt ein Knopf direkt zu den Quests. Das Inventar hat zwei Reiter: eigene Kosmetik und AntWars +, dazu „Mehr im Shop“ und einen Shop-Knopf. Bauen ohne Limit: Außenposten, Verteidigungswälle und Häfen stehen jetzt so oft in einem Gebiet, wie du willst und bezahlen kannst. Auch kleine Städte erzeugen langsam Ameisen. Wege laufen eckig über das Raster und treffen sich an Kreuzungen – keine Bögen mehr. Die Ameisenflaggen sind neu gezeichnet, die Kolonie läuft mit vielen Bauten flüssig, und im Spiel sind die Ränder links und rechts weg.'
where not exists (select 1 from public.news where version = 'v23');
