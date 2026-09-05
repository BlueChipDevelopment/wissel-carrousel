-- Kernschema van de wisselcarrousel (docs/requirements.md).
--
-- teams    - een team per seizoen (JO8-1 t/m JO8-4)
-- players  - spelers per team, alleen voornamen
-- matches  - één rij per team per wedstrijddatum: de opstelling zoals de coach die
--            heeft ingesteld. Het wisselschema zelf wordt niet opgeslagen; dat rekent
--            de app uit (src/domain/schedule.ts). Keeperbeurten worden afgeleid uit
--            matches.achter[0..3] van gespeelde wedstrijden.

create extension if not exists "pgcrypto";

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  club        text,
  season      text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint players_name_per_team unique (team_id, name)
);

create index players_team_idx on public.players (team_id, sort_order);

create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  match_date  date not null,
  opponent    text,
  -- bankbeurten: elke 5 minuten of per kwart
  wissel      text not null default '5min' check (wissel in ('5min', 'kwart')),
  formatie    text not null default '1-2-3' check (formatie in ('1-2-3', '1-2-1-2')),
  -- speler-ids in keepervolgorde (index 0 keept kwart 1)
  achter      uuid[] not null default '{}',
  -- speler-ids in opstellingsvolgorde (linksvoor, spits, rechtsvoor, wissel)
  voor        uuid[] not null default '{}',
  afwezig     uuid[] not null default '{}',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint matches_one_per_day unique (team_id, match_date)
);

create index matches_team_date_idx on public.matches (team_id, match_date desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- Keeperbeurten per speler, alleen van gespeelde wedstrijden (datum <= vandaag).
-- De eerste vier van achter[] zijn de keepers van kwart 1 t/m 4.
create view public.keeper_counts as
  select m.team_id, k.player_id, count(*)::integer as beurten
  from public.matches m
  cross join lateral unnest(m.achter) with ordinality as k(player_id, ord)
  where k.ord <= 4 and m.match_date <= current_date
  group by m.team_id, k.player_id;
