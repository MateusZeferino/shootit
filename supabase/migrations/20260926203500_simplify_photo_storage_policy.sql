-- Storage authorization is scoped to the user's own prefix. Collection
-- ownership is checked by the upload API and by public.photos RLS.
alter policy "Users can upload photos under their own prefix"
  on storage.objects
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

alter policy "Users can read photos under their own prefix"
  on storage.objects
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

alter policy "Users can delete photos under their own prefix"
  on storage.objects
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
