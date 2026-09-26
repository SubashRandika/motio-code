-- MotioCode 0004 -- let the owner advance their own render job.
--
-- 0001 assumed the renderer would be a server-side service using service_role,
-- which bypasses RLS, so it deliberately gave clients no UPDATE on render_jobs.
-- The export prototype renders in the browser instead: the owner's own session
-- *is* the renderer, and it has to report progress and the outcome.
--
-- The grant is column-scoped rather than a blanket UPDATE, because RLS cannot
-- restrict columns and these columns are not equal:
--
--   status, progress, error_message, started_at, completed_at
--     -> render telemetry. The renderer owns these.
--
--   project_id, owner_id, render_settings, output_path
--     -> not writable by a client, ever. owner_id and project_id decide who the
--        row belongs to; render_settings is the record of what was asked for, so
--        a rewritable one would make history a lie; and output_path names a file
--        in storage, so a client-writable path is a way to point a download at
--        someone else's object. When server-side rendering lands, service_role
--        writes that column.

-- Postgres has no "create policy if not exists", and this migration may be
-- applied by hand in the SQL editor before the CLI ever sees it, so the drop
-- makes a second run a no-op instead of an error.
drop policy if exists render_jobs_update_own on public.render_jobs;

create policy render_jobs_update_own on public.render_jobs
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

grant update (status, progress, error_message, started_at, completed_at)
  on public.render_jobs to authenticated;
