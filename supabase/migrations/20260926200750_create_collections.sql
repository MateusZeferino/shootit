create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  public_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collections_owner_created_idx
  on public.collections (owner_id, created_at desc);

alter table public.collections enable row level security;

revoke all on public.collections from public, anon, authenticated;
grant select, delete on public.collections to authenticated;
grant insert (name), update (name) on public.collections to authenticated;

create policy "Users can read their own collections"
  on public.collections
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Users can create their own collections"
  on public.collections
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Users can rename their own collections"
  on public.collections
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Users can delete their own collections"
  on public.collections
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create function private.touch_collection_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_collection_updated_at() from public, anon, authenticated;

create trigger on_collection_updated
  before update on public.collections
  for each row execute function private.touch_collection_updated_at();
