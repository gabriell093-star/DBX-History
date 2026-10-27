create index if not exists audit_logs_admin_id_idx on public.audit_logs (admin_id);
create index if not exists match_characters_debatter_id_idx on public.match_characters (debatter_id);
create index if not exists matches_participant_a_idx on public.matches (participant_a);
create index if not exists matches_participant_b_idx on public.matches (participant_b);
create index if not exists tournaments_tier_id_idx on public.tournaments (tier_id);
