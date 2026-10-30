-- DBX History S1: least-privilege table grants.
-- RLS remains the row-level authorization layer. SQL grants expose only
-- the operations required by the public archive and Founder CRUD client.

revoke all privileges on table
  public.tiers,
  public.tournaments,
  public.debatters,
  public.participations,
  public.characters,
  public.matches,
  public.match_characters,
  public.titles
from public, anon, authenticated;

grant select on table
  public.tiers,
  public.tournaments,
  public.debatters,
  public.participations,
  public.characters,
  public.matches,
  public.match_characters,
  public.titles
to anon, authenticated;

grant insert, update, delete on table
  public.tiers,
  public.tournaments,
  public.debatters,
  public.participations,
  public.characters,
  public.matches,
  public.match_characters,
  public.titles
to authenticated;

revoke all privileges on table public.admin_users, public.audit_logs
from public, anon, authenticated;

grant select on table public.admin_users, public.audit_logs
to authenticated;
