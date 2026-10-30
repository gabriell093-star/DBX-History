alter table public.titles
  drop constraint titles_debatter_id_fkey,
  add constraint titles_debatter_id_fkey
    foreign key (debatter_id) references public.debatters(id) on delete restrict,
  drop constraint titles_tournament_id_fkey,
  add constraint titles_tournament_id_fkey
    foreign key (tournament_id) references public.tournaments(id) on delete restrict;

alter table public.participations
  drop constraint participations_debatter_id_fkey,
  add constraint participations_debatter_id_fkey
    foreign key (debatter_id) references public.debatters(id) on delete restrict,
  drop constraint participations_tournament_id_fkey,
  add constraint participations_tournament_id_fkey
    foreign key (tournament_id) references public.tournaments(id) on delete restrict;

alter table public.matches
  drop constraint matches_tournament_id_fkey,
  add constraint matches_tournament_id_fkey
    foreign key (tournament_id) references public.tournaments(id) on delete restrict,
  drop constraint matches_winner_id_fkey,
  add constraint matches_winner_id_fkey
    foreign key (winner_id) references public.debatters(id) on delete restrict;

alter table public.match_characters
  drop constraint match_characters_debatter_id_fkey,
  add constraint match_characters_debatter_id_fkey
    foreign key (debatter_id) references public.debatters(id) on delete restrict,
  drop constraint match_characters_match_id_fkey,
  add constraint match_characters_match_id_fkey
    foreign key (match_id) references public.matches(id) on delete restrict;

alter table public.tournaments
  drop constraint tournaments_tier_id_fkey,
  add constraint tournaments_tier_id_fkey
    foreign key (tier_id) references public.tiers(id) on delete restrict;
