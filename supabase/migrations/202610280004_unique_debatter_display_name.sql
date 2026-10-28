-- Prevent accidental duplicate Debatter profiles caused by casing or extra whitespace.
create unique index if not exists debaters_display_name_normalized_unique_idx
on public.debatters (lower(regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g')));
