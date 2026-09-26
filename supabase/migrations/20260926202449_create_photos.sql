create table public.photos (
  id uuid primary key,
  collection_id uuid not null references public.collections (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index photos_collection_created_idx
  on public.photos (collection_id, created_at desc);

alter table public.photos enable row level security;

revoke all on public.photos from public, anon, authenticated;
grant select, delete on public.photos to authenticated;
grant insert (id, collection_id, storage_path, mime_type, file_size_bytes)
  on public.photos to authenticated;

create policy "Users can read photos in their own collections"
  on public.photos for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = (select auth.uid())
  ));

create policy "Users can add photos to their own collections"
  on public.photos for insert to authenticated
  with check (
    storage_path like (select auth.uid())::text || '/' || collection_id::text || '/%'
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );

create policy "Users can delete photos in their own collections"
  on public.photos for delete to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = (select auth.uid())
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "Users can upload photos under their own prefix"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.collections c
      where c.id::text = (storage.foldername(name))[2]
        and c.owner_id = (select auth.uid())
    )
  );

create policy "Users can read photos under their own prefix"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete photos under their own prefix"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
