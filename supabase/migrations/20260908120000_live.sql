-- Live aanpassen tijdens de wedstrijd (docs/superpowers/specs/2026-09-08-live-wissels-design.md).
--
-- matches.live     - de werkelijkheid naast het plan: huidig blok, bezetting per blok,
--                    handmatig gezette blokken en wie er uitvalt of later komt
--                    (src/domain/types.ts: Live). NULL zolang alles volgens plan is.
-- matches.keepers  - de werkelijke keepers (per kwart, soms twee bij een keeperswissel
--                    halverwege), door de app geschreven bij elke opslag. Leeg bij oude
--                    wedstrijden; dan telt achter[1:4] zoals voorheen.

alter table public.matches
  add column live    jsonb,
  add column keepers uuid[] not null default '{}';

-- Keeperbeurten: werkelijke keepers als die er zijn, anders de eerste vier van het plan.
create or replace view public.keeper_counts as
  select m.team_id, k.player_id, count(*)::integer as beurten
  from public.matches m
  cross join lateral unnest(
    case when cardinality(m.keepers) > 0 then m.keepers else m.achter[1:4] end
  ) as k(player_id)
  where m.match_date <= current_date
  group by m.team_id, k.player_id;

grant select on public.keeper_counts to anon, authenticated;

-- Realtime: beide coaches zien dezelfde wedstrijd. De rij is klein; last-write-wins via
-- updated_at in de app.
alter publication supabase_realtime add table public.matches;
