-- DBX History S1 initial schema.
-- Apply once to a new Supabase project. The linked project already has this schema.
create extension if not exists pgcrypto;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tiers (
  id uuid primary key default gen_random_uuid(),
  tier_name text not null unique,
  tier_description text,
  effective_date date,
  reference_source text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  tournament_name text not null,
  organizer text,
  start_date date,
  end_date date,
  status text not null default 'upcoming'
    check (status in ('upcoming','ongoing','completed','postponed','cancelled')),
  tier_id uuid references public.tiers(id) on delete set null,
  poster_url text,
  description text,
  rules text,
  format text,
  prize text,
  participant_requirements text,
  registration_url text,
  registration_open boolean not null default false,
  results_summary text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (not registration_open or registration_url is not null)
);

create table public.debatters (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  photo_url text,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participations (
  id uuid primary key default gen_random_uuid(),
  debatter_id uuid not null references public.debatters(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  placement integer check (placement is null or placement > 0),
  participation_status text not null default 'confirmed'
    check (participation_status in ('confirmed','withdrawn','disqualified','pending')),
  created_at timestamptz not null default now(),
  unique (debatter_id, tournament_id)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  character_name text not null unique,
  description text,
  image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  participant_a uuid not null references public.debatters(id) on delete restrict,
  participant_b uuid not null references public.debatters(id) on delete restrict,
  winner_id uuid references public.debatters(id) on delete set null,
  score_a numeric,
  score_b numeric,
  match_status text not null default 'scheduled'
    check (match_status in ('scheduled','completed','cancelled','disputed','incomplete')),
  match_date timestamptz,
  round_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_a <> participant_b),
  check (winner_id is null or winner_id in (participant_a, participant_b)),
  check (match_status <> 'completed' or winner_id is not null)
);

create table public.match_characters (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  debatter_id uuid not null references public.debatters(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (match_id, debatter_id, character_id)
);

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  debatter_id uuid not null references public.debatters(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  confirmation_status text not null default 'draft'
    check (confirmation_status in ('draft','needs_verification','verified','corrected')),
  confirmed_at timestamptz,
  verification_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (debatter_id, tournament_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index tournaments_public_listing_idx on public.tournaments (is_published, start_date desc);
create index tournaments_status_idx on public.tournaments (status, start_date desc);
create index tournaments_tier_id_idx on public.tournaments (tier_id);
create index titles_debatter_idx on public.titles (debatter_id, confirmation_status);
create index titles_tournament_idx on public.titles (tournament_id);
create index matches_tournament_status_idx on public.matches (tournament_id, match_status);
create index matches_winner_idx on public.matches (winner_id, match_status);
create index matches_participant_a_idx on public.matches (participant_a);
create index matches_participant_b_idx on public.matches (participant_b);
create index participations_tournament_idx on public.participations (tournament_id);
create index match_characters_match_idx on public.match_characters (match_id);
create index match_characters_character_idx on public.match_characters (character_id);
create index match_characters_debatter_id_idx on public.match_characters (debatter_id);
create index audit_logs_admin_id_idx on public.audit_logs (admin_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_competitive_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  before_data jsonb;
  after_data jsonb;
  row_id uuid;
begin
  if tg_op = 'INSERT' then
    before_data := null;
    after_data := to_jsonb(new);
    row_id := new.id;
  elsif tg_op = 'UPDATE' then
    before_data := to_jsonb(old);
    after_data := to_jsonb(new);
    row_id := new.id;
  else
    before_data := to_jsonb(old);
    after_data := null;
    row_id := old.id;
  end if;

  insert into public.audit_logs (admin_id, entity_type, entity_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, row_id, lower(tg_op), before_data, after_data);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare tbl text;
begin
  foreach tbl in array array['tiers','tournaments','debatters','characters','matches','titles'] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl, tbl
    );
  end loop;
  foreach tbl in array array['tiers','tournaments','debatters','characters','matches','titles','participations','match_characters'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.log_competitive_change()',
      tbl, tbl
    );
  end loop;
end;
$$;

alter table public.admin_users enable row level security;
alter table public.tiers enable row level security;
alter table public.tournaments enable row level security;
alter table public.debatters enable row level security;
alter table public.participations enable row level security;
alter table public.characters enable row level security;
alter table public.matches enable row level security;
alter table public.match_characters enable row level security;
alter table public.titles enable row level security;
alter table public.audit_logs enable row level security;

create policy "admins_can_read_own_membership" on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

create policy "public_read_active_tiers_or_published_references" on public.tiers
for select to anon, authenticated
using (is_active = true or exists (
  select 1 from public.tournaments t where t.tier_id = tiers.id and t.is_published = true
));

create policy "public_read_published_tournaments" on public.tournaments
for select to anon, authenticated using (is_published = true);

create policy "public_read_published_debatters" on public.debatters
for select to anon, authenticated using (is_published = true);

create policy "public_read_participations_of_published_tournaments" on public.participations
for select to anon, authenticated using (exists (
  select 1 from public.tournaments t where t.id = tournament_id and t.is_published = true
));

create policy "public_read_published_characters" on public.characters
for select to anon, authenticated using (is_published = true);

create policy "public_read_verified_titles" on public.titles
for select to anon, authenticated using (
  confirmation_status in ('verified','corrected')
  and exists (select 1 from public.debatters d where d.id = debatter_id and d.is_published = true)
  and exists (select 1 from public.tournaments t where t.id = tournament_id and t.is_published = true)
);

create policy "public_read_completed_matches_in_published_tournaments" on public.matches
for select to anon, authenticated using (
  match_status = 'completed' and winner_id is not null
  and exists (select 1 from public.tournaments t where t.id = tournament_id and t.is_published = true)
);

create policy "public_read_characters_from_published_completed_matches" on public.match_characters
for select to anon, authenticated using (exists (
  select 1 from public.matches m join public.tournaments t on t.id = m.tournament_id
  where m.id = match_id and m.match_status = 'completed' and m.winner_id is not null and t.is_published = true
));

create policy "admins_read_audit_logs" on public.audit_logs
for select to authenticated using (exists (
  select 1 from public.admin_users a where a.user_id = (select auth.uid())
));

create policy "admins_insert_audit_logs" on public.audit_logs
for insert to authenticated with check (exists (
  select 1 from public.admin_users a where a.user_id = (select auth.uid())
));

do $$
declare tbl text;
begin
  foreach tbl in array array['tiers','tournaments','debatters','participations','characters','matches','match_characters','titles'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))) with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))',
      'admins_manage_' || tbl, tbl
    );
  end loop;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.tiers, public.tournaments, public.debatters, public.participations,
  public.characters, public.matches, public.match_characters, public.titles to anon, authenticated;
grant select on public.admin_users to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant insert, update, delete on public.tiers, public.tournaments, public.debatters, public.participations,
  public.characters, public.matches, public.match_characters, public.titles to authenticated;

insert into storage.buckets (id, name, public)
values ('dbx-assets', 'dbx-assets', true)
on conflict (id) do update set public = excluded.public;

create policy "dbx_assets_public_read" on storage.objects
for select to anon, authenticated using (bucket_id = 'dbx-assets');

create policy "dbx_assets_admin_insert" on storage.objects
for insert to authenticated with check (
  bucket_id = 'dbx-assets'
  and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
);

create policy "dbx_assets_admin_update" on storage.objects
for update to authenticated
using (bucket_id = 'dbx-assets' and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (bucket_id = 'dbx-assets' and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "dbx_assets_admin_delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'dbx-assets'
  and exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
);
