-- MotioCode - private storage buckets.
-- Path convention for every bucket: {owner_id}/{project_id}/{filename}
-- so the first folder segment is the owning user's id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-assets', 'project-assets', false, 52428800,
   array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','font/woff2','font/woff','audio/mpeg','audio/wav']),
  ('project-thumbnails', 'project-thumbnails', false, 2097152,
   array['image/png','image/jpeg','image/webp']),
  ('project-renders', 'project-renders', false, 524288000,
   array['video/mp4','video/webm','image/gif'])
on conflict (id) do nothing;

-- project-assets: full owner control (select+insert+update are all needed for upsert).
create policy "own folder read assets" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder insert assets" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder update assets" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder delete assets" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- project-thumbnails: same, overwritten on every save.
create policy "own folder read thumbnails" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder insert thumbnails" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder update thumbnails" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder delete thumbnails" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- project-renders: written by the render service (service_role). Clients read and delete only.
create policy "own folder read renders" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-renders' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own folder delete renders" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-renders' and (storage.foldername(name))[1] = (select auth.uid())::text);
