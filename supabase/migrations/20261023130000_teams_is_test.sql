-- Sandboxteam voor de e2e-tests tegen de echte database (npm run test:e2e:db).
--
-- teams.is_test = true: de app laat zo'n team niet zien aan coaches (alleen met de
-- localStorage-vlag `wisselcarrousel.testteams`), en de e2e-suite weigert te draaien tegen een
-- team zonder deze vlag. Het team zelf maakt de suite aan met de service-role key.

alter table public.teams
  add column is_test boolean not null default false;
