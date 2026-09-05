-- Row-Level Security: voorlopig OPEN (docs/decisions/0001-stack.md, "toegang").
--
-- Bewuste keuze: er is nog geen login. Iedereen met de link (de anon key zit in de
-- client) mag alle teams lezen en schrijven. Er staan alleen voornamen in.
--
-- Zodra er magic-link login komt, vervang je deze policies door:
--   select  -> authenticated
--   write   -> coach van het team (team_coaches op e-mail) of admin
-- Zie het upgradepad in docs/decisions/0001-stack.md.

alter table public.teams   enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

create policy "teams open lezen"    on public.teams   for select to anon, authenticated using (true);
create policy "players open lezen"  on public.players for select to anon, authenticated using (true);
create policy "matches open lezen"  on public.matches for select to anon, authenticated using (true);

create policy "players open schrijven" on public.players
  for all to anon, authenticated using (true) with check (true);
create policy "matches open schrijven" on public.matches
  for all to anon, authenticated using (true) with check (true);

-- teams worden alleen via migrations/SQL beheerd (geen policy voor schrijven).

grant usage on schema public to anon, authenticated;
grant select on public.teams, public.keeper_counts to anon, authenticated;
grant select, insert, update, delete on public.players, public.matches to anon, authenticated;
