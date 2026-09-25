import "server-only";

import type { Project, ProjectSummary } from "@/core/model";
import { createClient } from "@/lib/supabase/server";

import { rowToCanvas, rowToProjectMeta, rowsToProject } from "./mappers";

const PROJECT_COLUMNS =
  "id, owner_id, name, description, content_type, canvas_config, theme_config, export_config, template_id, thumbnail_path, data_version, last_opened_at, created_at, updated_at";

/**
 * Projects for the dashboard, most recently touched first.
 *
 * RLS already restricts rows to the owner; the explicit `owner_id` filter is
 * defence in depth and lets the query use the owner index.
 */
export async function listProjects(ownerId: string, search?: string): Promise<ProjectSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(`${PROJECT_COLUMNS}, project_scenes(count)`)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(60);

  const term = search?.trim();
  if (term) {
    // `ilike` on a short list is fine at MVP scale; revisit with a trigram
    // index if project counts grow.
    query = query.ilike("name", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load your projects: ${error.message}`);

  return (data ?? []).map((row) => {
    const { project_scenes: sceneCount, ...project } = row;
    return {
      ...rowToProjectMeta(project),
      canvas: rowToCanvas(project),
      sceneCount: Array.isArray(sceneCount) ? (sceneCount[0]?.count ?? 0) : 0,
    };
  });
}

/** A full project with its scene graph, or null when it does not exist. */
export async function loadProject(projectId: string, ownerId: string): Promise<Project | null> {
  const supabase = await createClient();

  const [{ data: project, error: projectError }, { data: scenes, error: scenesError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(PROJECT_COLUMNS)
        .eq("id", projectId)
        .eq("owner_id", ownerId)
        .maybeSingle(),
      supabase
        .from("project_scenes")
        .select("*")
        .eq("project_id", projectId)
        .order("scene_order", { ascending: true }),
    ]);

  if (projectError) throw new Error(`Could not open the project: ${projectError.message}`);
  if (!project) return null;
  if (scenesError) throw new Error(`Could not load the scenes: ${scenesError.message}`);

  return rowsToProject(project, scenes ?? []);
}

export async function countProjects(ownerId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  if (error) throw new Error(`Could not count your projects: ${error.message}`);
  return count ?? 0;
}
