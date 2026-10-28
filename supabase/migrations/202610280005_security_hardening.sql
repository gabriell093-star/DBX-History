-- DBX History S1: persistent login throttling, immutable audit logs, and database input constraints.
create table if not exists public.admin_login_rate_limits (
  bucket_type text not null check (bucket_type in ('ip', 'username')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  hit_count integer not null default 0 check (hit_count >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket_type, key_hash)
);
alter table public.admin_login_rate_limits enable row level security;
revoke all on table public.admin_login_rate_limits from public, anon, authenticated;
grant all on table public.admin_login_rate_limits to service_role;

create or replace function public.consume_admin_login_attempt(p_ip_hash text, p_username_hash text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ip_count integer;
  v_ip_start timestamptz;
  v_username_count integer;
  v_username_start timestamptz;
  v_retry integer := 0;
begin
  if coalesce(p_ip_hash, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_username_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key.';
  end if;
  delete from public.admin_login_rate_limits where updated_at < v_now - interval '1 day';

  insert into public.admin_login_rate_limits (bucket_type, key_hash, hit_count, window_started_at, updated_at)
  values ('ip', p_ip_hash, 1, v_now, v_now)
  on conflict (bucket_type, key_hash) do update
    set hit_count = case when public.admin_login_rate_limits.window_started_at <= v_now - interval '15 minutes' then 1 else public.admin_login_rate_limits.hit_count + 1 end,
        window_started_at = case when public.admin_login_rate_limits.window_started_at <= v_now - interval '15 minutes' then v_now else public.admin_login_rate_limits.window_started_at end,
        updated_at = v_now;

  insert into public.admin_login_rate_limits (bucket_type, key_hash, hit_count, window_started_at, updated_at)
  values ('username', p_username_hash, 1, v_now, v_now)
  on conflict (bucket_type, key_hash) do update
    set hit_count = case when public.admin_login_rate_limits.window_started_at <= v_now - interval '15 minutes' then 1 else public.admin_login_rate_limits.hit_count + 1 end,
        window_started_at = case when public.admin_login_rate_limits.window_started_at <= v_now - interval '15 minutes' then v_now else public.admin_login_rate_limits.window_started_at end,
        updated_at = v_now;

  select hit_count, window_started_at into v_ip_count, v_ip_start
    from public.admin_login_rate_limits where bucket_type = 'ip' and key_hash = p_ip_hash;
  select hit_count, window_started_at into v_username_count, v_username_start
    from public.admin_login_rate_limits where bucket_type = 'username' and key_hash = p_username_hash;

  if v_ip_count > 20 then
    v_retry := greatest(v_retry, ceil(extract(epoch from (v_ip_start + interval '15 minutes' - v_now)))::integer);
  end if;
  if v_username_count > 5 then
    v_retry := greatest(v_retry, ceil(extract(epoch from (v_username_start + interval '15 minutes' - v_now)))::integer);
  end if;

  return query select (v_ip_count <= 20 and v_username_count <= 5),
    case when (v_ip_count > 20 or v_username_count > 5) then greatest(1, v_retry) else 0 end;
end;
$$;
revoke all on function public.consume_admin_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.consume_admin_login_attempt(text, text) to service_role;

create or replace function public.clear_admin_login_username_attempts(p_username_hash text)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if coalesce(p_username_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid rate-limit key.'; end if;
  delete from public.admin_login_rate_limits where bucket_type = 'username' and key_hash = p_username_hash;
end;
$$;
revoke all on function public.clear_admin_login_username_attempts(text) from public, anon, authenticated;
grant execute on function public.clear_admin_login_username_attempts(text) to service_role;

create or replace function public.log_competitive_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare before_data jsonb; after_data jsonb; row_id uuid;
begin
  if tg_op = 'INSERT' then before_data := null; after_data := to_jsonb(new); row_id := new.id;
  elsif tg_op = 'UPDATE' then before_data := to_jsonb(old); after_data := to_jsonb(new); row_id := new.id;
  else before_data := to_jsonb(old); after_data := null; row_id := old.id;
  end if;
  insert into public.audit_logs (admin_id, entity_type, entity_id, action, old_data, new_data)
  values (auth.uid(), tg_table_name, row_id, lower(tg_op), before_data, after_data);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke insert, update, delete, truncate, references, trigger on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;
drop policy if exists founders_insert_audit_logs on public.audit_logs;
drop policy if exists admins_insert_audit_logs on public.audit_logs;

alter table public.tournaments
  add constraint tournaments_name_length_check check (char_length(btrim(tournament_name)) between 1 and 160),
  add constraint tournaments_organizer_length_check check (organizer is null or char_length(organizer) <= 120),
  add constraint tournaments_description_length_check check (description is null or char_length(description) <= 5000),
  add constraint tournaments_rules_length_check check (rules is null or char_length(rules) <= 5000),
  add constraint tournaments_results_length_check check (results_summary is null or char_length(results_summary) <= 5000),
  add constraint tournaments_requirements_length_check check (participant_requirements is null or char_length(participant_requirements) <= 2500),
  add constraint tournaments_format_length_check check (format is null or char_length(format) <= 120),
  add constraint tournaments_prize_length_check check (prize is null or char_length(prize) <= 180),
  add constraint tournaments_poster_https_check check (poster_url is null or (char_length(poster_url) <= 2048 and lower(btrim(poster_url)) like 'https://%' and poster_url !~ '[[:space:]]')),
  add constraint tournaments_registration_https_check check (registration_url is null or (char_length(registration_url) <= 2048 and lower(btrim(registration_url)) like 'https://%' and registration_url !~ '[[:space:]]'));

alter table public.debatters
  add constraint debaters_display_name_length_check check (char_length(btrim(display_name)) between 1 and 80),
  add constraint debaters_description_length_check check (description is null or char_length(description) <= 2000),
  add constraint debaters_photo_https_check check (photo_url is null or (char_length(photo_url) <= 2048 and lower(btrim(photo_url)) like 'https://%' and photo_url !~ '[[:space:]]'));

alter table public.characters
  add constraint characters_name_length_check check (char_length(btrim(character_name)) between 1 and 120),
  add constraint characters_description_length_check check (description is null or char_length(description) <= 2000),
  add constraint characters_image_https_check check (image_url is null or (char_length(image_url) <= 2048 and lower(btrim(image_url)) like 'https://%' and image_url !~ '[[:space:]]'));

alter table public.tiers
  add constraint tiers_name_length_check check (char_length(btrim(tier_name)) between 1 and 80),
  add constraint tiers_description_length_check check (tier_description is null or char_length(tier_description) <= 2000),
  add constraint tiers_reference_https_check check (reference_source is null or (char_length(reference_source) <= 2048 and lower(btrim(reference_source)) like 'https://%' and reference_source !~ '[[:space:]]'));

alter table public.matches
  add constraint matches_scores_nonnegative_check check ((score_a is null or score_a >= 0) and (score_b is null or score_b >= 0)),
  add constraint matches_round_length_check check (round_label is null or char_length(round_label) <= 120),
  add constraint matches_notes_length_check check (notes is null or char_length(notes) <= 2000);

alter table public.titles
  add constraint titles_source_length_check check (verification_source is null or char_length(verification_source) <= 2048),
  add constraint titles_notes_length_check check (notes is null or char_length(notes) <= 2000);
