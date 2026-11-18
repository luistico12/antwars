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

-- ============ Hilfsfunktionen ============
create or replace function public.is_admin() returns boolean
language sql security definer set search_path=public stable as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, username)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'username'),''), nullif(trim(new.raw_user_meta_data->>'full_name'),''), 'Spieler'),20))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Schützt privilegierte Spalten: Spieler dürfen nur Name, Clan-Tag, Hut und Flagge ändern (und nur Besitz ausrüsten).
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if coalesce(current_setting('app.rpc', true),'') = '1' or public.is_admin() then return new; end if;
  new.rubys := old.rubys; new.wins := old.wins; new.games := old.games; new.owned := old.owned;
  new.quests := old.quests; new.stats := old.stats; new.is_admin := old.is_admin; new.id := old.id; new.created_at := old.created_at;
  if new.hat is not null and not ('hat:'||new.hat) = any(old.owned) then new.hat := old.hat; end if;
  if new.flag is not null and not ('flag:'||new.flag) = any(old.owned) then new.flag := old.flag; end if;
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

-- Lobby per Code finden (auch private) – gibt nur diese eine Zeile zurück
create or replace function public.find_lobby(c text) returns setof public.lobbies
language sql security definer set search_path=public stable as
$$ select * from public.lobbies where code = c and status = 'open' limit 1 $$;

-- ============ Ranglisten (nur öffentliche Spalten) ============
create or replace view public.leaderboard_players with (security_invoker=false) as
  select username, clan_tag, wins, games from public.profiles where games > 0;
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
insert into public.quests(id,kind,stat,goal,reward) values
 ('d_games','daily','games',1,1),('d_terr','daily','terr',3,1),('d_found','daily','found',1,1),
 ('w_games','weekly','games',5,2),('w_wins','weekly','wins',1,3),('w_terr','weekly','terr',8,2),
 ('c_games','career','games',10,2),('c_wins','career','wins',5,5),('c_terr','career','terr',12,3),('c_found','career','found',25,3),('c_allied','career','allied',1,1),('c_score','career','score',300,3)
on conflict (id) do update set kind=excluded.kind, stat=excluded.stat, goal=excluded.goal, reward=excluded.reward;
insert into public.news(version,title,body) values ('v11','Neues Design, Konten und Shop','Komplett neues Glas-Interface, Anmeldung per E-Mail, Google oder Discord, Rubys durch Quests, Hüte und Flaggen im Shop, Clans über freie Tags und Ranglisten.');

-- Admin ernennen (manuell, einmalig, im SQL-Editor – NICHT über die App):
--   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'du@example.com');
