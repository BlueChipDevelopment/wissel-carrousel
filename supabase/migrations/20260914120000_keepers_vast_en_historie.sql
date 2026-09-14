-- Keepers vastzetten en een historie van elke opslag.
--
-- matches.keepers_vast - true zodra de coach de keepers achteraf heeft gecorrigeerd op de
--                        pagina Wedstrijden. De app leidt keepers dan niet meer af uit de
--                        live-blokken bij het opslaan (keepersWerkelijk), maar laat de lijst staan.
-- match_history        - elke insert/update/delete op matches als losse rij, met tijdstip.
--                        Zo is na een misgelopen samenvoeging tussen twee telefoons elke
--                        eerdere versie terug te vinden (zie docs/deploy.md, "historie").

alter table public.matches
  add column keepers_vast boolean not null default false;

create table public.match_history (
  id           bigint generated always as identity primary key,
  match_id     uuid not null,
  team_id      uuid not null,
  match_date   date not null,
  saved_at     timestamptz not null default now(),
  actie        text not null check (actie in ('insert', 'update', 'delete')),
  opponent     text,
  wissel       text not null,
  formatie     text not null,
  achter       uuid[] not null,
  voor         uuid[] not null,
  afwezig      uuid[] not null,
  keepers      uuid[] not null,
  keepers_vast boolean not null,
  live         jsonb,
  notes        text
);

create index match_history_match_idx on public.match_history (match_id, saved_at desc);
create index match_history_team_date_idx on public.match_history (team_id, match_date, saved_at desc);

-- security definer: anon mag zelf niets in de historie schrijven, alleen via deze trigger.
create or replace function public.log_match_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.matches;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.match_history
    (match_id, team_id, match_date, actie, opponent, wissel, formatie,
     achter, voor, afwezig, keepers, keepers_vast, live, notes)
  values
    (r.id, r.team_id, r.match_date, lower(tg_op), r.opponent, r.wissel, r.formatie,
     r.achter, r.voor, r.afwezig, r.keepers, r.keepers_vast, r.live, r.notes);
  return null;
end;
$$;

revoke all on function public.log_match_history() from public, anon, authenticated;

create trigger matches_log_history
  after insert or update or delete on public.matches
  for each row execute function public.log_match_history();

alter table public.match_history enable row level security;
create policy "match_history open lezen" on public.match_history
  for select to anon, authenticated using (true);
grant select on public.match_history to anon, authenticated;

-- De huidige stand als eerste historierij, zodat de log niet leeg begint.
insert into public.match_history
  (match_id, team_id, match_date, actie, opponent, wissel, formatie,
   achter, voor, afwezig, keepers, keepers_vast, live, notes, saved_at)
select id, team_id, match_date, 'update', opponent, wissel, formatie,
       achter, voor, afwezig, keepers, keepers_vast, live, notes, updated_at
from public.matches;
