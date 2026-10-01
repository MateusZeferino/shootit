alter table public.collections
  add column is_active boolean not null default true;

grant update (is_active) on public.collections to authenticated;
