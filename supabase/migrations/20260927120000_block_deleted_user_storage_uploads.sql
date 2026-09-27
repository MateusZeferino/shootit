-- Access JWTs can outlive account deletion. Require a live profile before
-- accepting any new object under a user's prefix.
alter policy "Users can upload photos under their own prefix"
  on storage.objects
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
    )
  );
