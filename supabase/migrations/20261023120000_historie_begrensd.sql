-- match_history begrenzen.
--
-- Elke live-actie (slepen, blok van de klok, undo) slaat de wedstrijd stil op, en elke opslag
-- werd een historierij met de hele live-stand. Twee aanpassingen:
--
-- 1. Een update die niets verandert behalve updated_at levert geen historierij meer op.
-- 2. Per wedstrijd blijven de nieuwste 200 versies staan; ruim genoeg voor één wedstrijddag
--    met live-wissels, en de oudere zijn na een samenvoegfout niet meer nodig.

create or replace function public.log_match_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.matches;
  grens bigint;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.match_history
    (match_id, team_id, match_date, actie, opponent, wissel, formatie,
     achter, voor, afwezig, keepers, keepers_vast, live, notes)
  values
    (r.id, r.team_id, r.match_date, lower(tg_op), r.opponent, r.wissel, r.formatie,
     r.achter, r.voor, r.afwezig, r.keepers, r.keepers_vast, r.live, r.notes);

  -- id is oplopend (identity), dus de 200e nieuwste rij is de grens.
  select h.id into grens
  from public.match_history h
  where h.match_id = r.id
  order by h.id desc
  offset 199 limit 1;
  if grens is not null then
    delete from public.match_history h where h.match_id = r.id and h.id < grens;
  end if;
  return null;
end;
$$;

revoke all on function public.log_match_history() from public, anon, authenticated;

drop trigger if exists matches_log_history on public.matches;

create trigger matches_log_history_insert_delete
  after insert or delete on public.matches
  for each row execute function public.log_match_history();

create trigger matches_log_history_update
  after update on public.matches
  for each row
  when ((old.match_date, old.opponent, old.wissel, old.formatie, old.achter, old.voor, old.afwezig,
         old.keepers, old.keepers_vast, old.live, old.notes)
        is distinct from
        (new.match_date, new.opponent, new.wissel, new.formatie, new.achter, new.voor, new.afwezig,
         new.keepers, new.keepers_vast, new.live, new.notes))
  execute function public.log_match_history();

-- Bestaande historie meteen terugbrengen tot de nieuwste 200 per wedstrijd.
delete from public.match_history h
using (
  select id, row_number() over (partition by match_id order by id desc) as nr
  from public.match_history
) n
where h.id = n.id and n.nr > 200;
