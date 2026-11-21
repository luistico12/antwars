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
