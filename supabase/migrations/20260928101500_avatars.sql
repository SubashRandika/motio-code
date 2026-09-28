-- MotioCode -- a picture people choose, and a way to say no to Gravatar.
--
-- Two things arrive together because they are two halves of one decision: what
-- the header shows for a user. The order of preference is
--
--   uploaded avatar  ->  Gravatar (if allowed)  ->  their initial
--
-- and this migration supplies the storage for the first and the switch for the
-- second.

-- ---------------------------------------------------------------- the switch
--
-- Gravatar is a third-party lookup keyed on a hash of the user's email address.
-- That is a reasonable default -- the address is never sent in the clear, and
-- the request is proxied through our own origin so Automattic never sees a
-- user's IP -- but it is still an inference from their email that some people
-- will not want made. Defaulting to true keeps existing behaviour; the column
-- exists so that is a choice rather than an assumption.
alter table public.profiles
  add column if not exists use_gravatar boolean not null default true;

comment on column public.profiles.use_gravatar is
  'Whether to fall back to Gravatar when no avatar has been uploaded.';

-- --------------------------------------------------------------- the bucket
--
-- This is the only PUBLIC bucket in the project, which is a deliberate
-- exception to the convention in motiocode_storage_buckets, for one reason: caching.
--
-- A private bucket is read through a signed URL, and a signed URL carries a
-- fresh signature every time it is generated. The header renders avatars
-- through next/image, which caches on the URL -- so a signature that changes on
-- every page render means a cache key that changes on every page render, and
-- the optimizer would re-fetch and re-encode the same picture forever. It would
-- also add a Storage round-trip to every authenticated page load.
--
-- What is actually being traded away is small: an avatar at an unguessable path
-- is readable by anyone holding the URL. That is the same exposure every other
-- product's profile picture has, and it is not the same class of data as a
-- user's projects or renders, which stay private.
--
-- SVG is deliberately absent from the allowed types. An SVG is a document that
-- can carry script, so a public bucket serving user-supplied SVG is a stored
-- XSS primitive. PNG, JPEG and WebP cannot execute.
--
-- The 2MB limit and the type list are enforced by Storage itself, server-side,
-- which is what makes them worth anything -- the browser check in the upload
-- form is a courtesy to the user, not a control.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --------------------------------------------------------------- the policies
--
-- Same path convention as every other bucket: the first folder segment is the
-- owner's id, so a user can only ever write inside their own prefix. Reading is
-- public by way of the bucket flag above; these policies govern the API, and
-- writing stays owner-only.
--
-- `drop` first because Postgres has no "create policy if not exists" and this
-- may be applied by hand before the CLI ever sees it.
drop policy if exists "own folder read avatars" on storage.objects;
create policy "own folder read avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own folder insert avatars" on storage.objects;
create policy "own folder insert avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Update as well as insert: replacing a picture is an upsert, and an upsert
-- with only INSERT granted fails silently.
drop policy if exists "own folder update avatars" on storage.objects;
create policy "own folder update avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own folder delete avatars" on storage.objects;
create policy "own folder delete avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
