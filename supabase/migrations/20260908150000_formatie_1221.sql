-- Formatie 1-2-2-1 (keeper, 2 verdedigers, 2 middenvelders, 1 spits). Alleen de plekken
-- voorin veranderen; het wisselschema niet (src/domain/schedule.ts: positieNamen).

alter table public.matches drop constraint matches_formatie_check;
alter table public.matches
  add constraint matches_formatie_check check (formatie in ('1-2-3', '1-2-1-2', '1-2-2-1'));
