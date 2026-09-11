-- Derde wisselstand 'vrij': keepers zoals gepland, de bank rouleert over iedereen en wie erin
-- komt neemt de plek over van wie eruit gaat, ook over de linies heen (src/domain/schedule.ts:
-- blokkenVrij, VRIJ8). Alleen de check op de kolom wordt ruimer; het schema rekent de app uit.
alter table public.matches drop constraint if exists matches_wissel_check;
alter table public.matches add constraint matches_wissel_check check (wissel in ('5min', 'kwart', 'vrij'));
