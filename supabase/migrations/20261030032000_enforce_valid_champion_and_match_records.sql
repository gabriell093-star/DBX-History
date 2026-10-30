alter table public.matches
  add constraint matches_distinct_participants_chk
    check (participant_a <> participant_b),
  add constraint matches_winner_is_participant_chk
    check (winner_id is null or winner_id in (participant_a, participant_b)),
  add constraint matches_completed_requires_winner_chk
    check (match_status <> 'completed' or winner_id is not null);

alter table public.titles
  add constraint titles_confirmed_requires_timestamp_chk
    check (confirmation_status not in ('verified', 'corrected') or confirmed_at is not null);

create or replace function public.enforce_verified_title_has_confirmed_first_place()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.confirmation_status in ('verified', 'corrected') and not exists (
    select 1 from public.participations p
    where p.debatter_id = new.debatter_id
      and p.tournament_id = new.tournament_id
      and p.placement = 1
      and p.participation_status = 'confirmed'
  ) then
    raise exception 'A verified champion title requires a confirmed first-place participation record.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger titles_require_confirmed_first_place
before insert or update of debatter_id, tournament_id, confirmation_status
on public.titles
for each row execute function public.enforce_verified_title_has_confirmed_first_place();

create or replace function public.protect_verified_champion_participation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.titles t
    where t.debatter_id = old.debatter_id
      and t.tournament_id = old.tournament_id
      and t.confirmation_status in ('verified', 'corrected')
  ) then
    if tg_op = 'DELETE'
       or row(new.debatter_id, new.tournament_id, new.placement, new.participation_status)
          is distinct from
          row(old.debatter_id, old.tournament_id, old.placement, old.participation_status) then
      raise exception 'A confirmed first-place participation is protected while its champion title is verified. Correct or downgrade the title first.'
        using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger protect_verified_champion_participation
before update or delete on public.participations
for each row execute function public.protect_verified_champion_participation();
