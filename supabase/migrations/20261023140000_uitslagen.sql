-- Uitslagen, voor het eigen overzicht van de JO8-teams (geen officiële stand).
--
-- goals_voor / goals_tegen: de stand vanuit ons team. Allebei leeg = nog geen uitslag; de app
-- schrijft ze altijd samen (pagina Wedstrijden). Het opslaan van de opstelling raakt ze niet.

alter table public.matches
  add column goals_voor smallint check (goals_voor between 0 and 99),
  add column goals_tegen smallint check (goals_tegen between 0 and 99),
  add constraint matches_uitslag_compleet check ((goals_voor is null) = (goals_tegen is null));
