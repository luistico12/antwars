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

-- News v22
insert into public.news (version, title, body)
select 'v22', 'Öffentliche Spiele auf dem Spielserver', 'Im Menü gibt es jetzt Öffentliche Spiele: Tritt einem Raum auf dem Spielserver bei, wähle einen Modus (Klassisch, Schnell, Chaos oder Unbegrenzt) und spiele mit bis zu acht Mitspielern. Die Liste zeigt wartende und laufende Räume mit Spielerzahl und Countdown und aktualisiert sich alle paar Sekunden. Auch anonyme Spieler können mitmachen.'
where not exists (select 1 from public.news where version = 'v22');
