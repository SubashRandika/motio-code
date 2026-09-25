"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { createBlankProjectDraft, createUuid } from "@/core/model";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

import {
  createProjectSchema,
  projectSavePayloadSchema,
  renameProjectSchema,
  type ProjectSavePayload,
} from "./schema";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) result[key] = issue.message;
  }
  return result;
}

/** Create a project with its first scene, then open the editor. */
export async function createProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/projects/new");

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    contentType: formData.get("contentType"),
    aspectRatio: formData.get("aspectRatio"),
    fps: formData.get("fps"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const draft = createBlankProjectDraft(parsed.data);
  const supabase = await createClient();
  const projectId = createUuid();

  const { error: projectError } = await supabase.from("projects").insert({
    id: projectId,
    owner_id: user.id,
    name: draft.name,
    content_type: draft.contentType,
    canvas_config: draft.canvas,
    theme_config: draft.theme,
    export_config: draft.export,
    last_opened_at: new Date().toISOString(),
  });

  if (projectError) {
    return { error: `Could not create the project: ${projectError.message}` };
  }

  const { error: sceneError } = await supabase.from("project_scenes").insert(
    draft.scenes.map((scene) => ({
      id: scene.id,
      project_id: projectId,
      // Overwritten by the sync_scene_owner trigger; required by the types.
      owner_id: user.id,
      name: scene.name,
      scene_order: scene.order,
      duration_in_frames: scene.durationInFrames,
      scene_data: scene.data,
    })),
  );

  if (sceneError) {
    // Leaving a project with no scenes would break the editor, so undo it.
    await supabase.from("projects").delete().eq("id", projectId);
    return { error: `Could not create the first scene: ${sceneError.message}` };
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}/editor`);
}

export async function renameProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = renameProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.projectId)
    .eq("owner_id", user.id);

  if (error) return { error: `Could not rename the project: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${parsed.data.projectId}/editor`);
  return {};
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", user.id);

  if (error) throw new Error(`Could not delete the project: ${error.message}`);

  revalidatePath("/dashboard");
}

/** Copy a project and all of its scenes into a new project. */
export async function duplicateProjectAction(projectId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: source, error: sourceError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (sourceError) throw new Error(`Could not read the project: ${sourceError.message}`);
  if (!source) throw new Error("That project no longer exists.");

  const { data: scenes, error: scenesError } = await supabase
    .from("project_scenes")
    .select("*")
    .eq("project_id", projectId)
    .order("scene_order", { ascending: true });

  if (scenesError) throw new Error(`Could not read the scenes: ${scenesError.message}`);

  const copyId = createUuid();
  const { error: insertError } = await supabase.from("projects").insert({
    id: copyId,
    owner_id: user.id,
    name: `${source.name} copy`.slice(0, 120),
    description: source.description,
    content_type: source.content_type,
    canvas_config: source.canvas_config,
    theme_config: source.theme_config,
    export_config: source.export_config,
    template_id: source.template_id,
    data_version: source.data_version,
  });

  if (insertError) throw new Error(`Could not duplicate the project: ${insertError.message}`);

  if (scenes && scenes.length > 0) {
    const { error: copyScenesError } = await supabase.from("project_scenes").insert(
      scenes.map((scene) => ({
        id: createUuid(),
        project_id: copyId,
        owner_id: user.id,
        name: scene.name,
        scene_order: scene.scene_order,
        duration_in_frames: scene.duration_in_frames,
        scene_data: scene.scene_data,
        data_version: scene.data_version,
      })),
    );

    if (copyScenesError) {
      await supabase.from("projects").delete().eq("id", copyId);
      throw new Error(`Could not duplicate the scenes: ${copyScenesError.message}`);
    }
  }

  revalidatePath("/dashboard");
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
}

/**
 * Persist the editor's working copy.
 *
 * Scenes are reconciled rather than replaced, so scene rows keep their ids and
 * timestamps across saves. The unique constraint on (project_id, scene_order)
 * is deferred, which lets a reorder land in one transaction.
 */
export async function saveProjectAction(payload: ProjectSavePayload): Promise<SaveResult> {
  const user = await requireUser();

  const parsed = projectSavePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That project is not valid." };
  }

  const project = parsed.data;
  const supabase = await createClient();

  const { data: owned, error: ownerError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project.projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (ownerError) return { ok: false, error: `Could not save: ${ownerError.message}` };
  if (!owned) return { ok: false, error: "That project no longer exists." };

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      name: project.name,
      description: project.description,
      canvas_config: project.canvas,
      theme_config: project.theme,
      export_config: project.export,
    })
    .eq("id", project.projectId)
    .eq("owner_id", user.id);

  if (updateError) return { ok: false, error: `Could not save: ${updateError.message}` };

  const { data: existing, error: existingError } = await supabase
    .from("project_scenes")
    .select("id")
    .eq("project_id", project.projectId);

  if (existingError) return { ok: false, error: `Could not save the scenes: ${existingError.message}` };

  const incomingIds = new Set(project.scenes.map((scene) => scene.id));
  const removed = (existing ?? []).map((row) => row.id).filter((id) => !incomingIds.has(id));

  if (removed.length > 0) {
    const { error: deleteError } = await supabase
      .from("project_scenes")
      .delete()
      .in("id", removed)
      .eq("project_id", project.projectId);

    if (deleteError) return { ok: false, error: `Could not remove deleted scenes: ${deleteError.message}` };
  }

  const { error: upsertError } = await supabase.from("project_scenes").upsert(
    project.scenes.map((scene) => ({
      id: scene.id,
      project_id: project.projectId,
      owner_id: user.id,
      name: scene.name,
      scene_order: scene.order,
      duration_in_frames: scene.durationInFrames,
      scene_data: scene.data,
    })),
    { onConflict: "id" },
  );

  if (upsertError) return { ok: false, error: `Could not save the scenes: ${upsertError.message}` };

  revalidatePath("/dashboard");
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Records that a project was opened, so "resume" ordering stays useful. */
export async function touchProjectAction(projectId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  // No revalidate: this only affects "resume" ordering on the next load.
  await supabase
    .from("projects")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("owner_id", user.id);
}
