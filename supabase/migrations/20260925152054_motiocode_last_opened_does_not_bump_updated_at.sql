-- Opening a project records last_opened_at. That should not count as an edit,
-- otherwise the dashboard's "edited" timestamp changes just from looking.
drop trigger if exists projects_set_updated_at on public.projects;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  when (old.last_opened_at is not distinct from new.last_opened_at)
  execute function public.set_updated_at();
