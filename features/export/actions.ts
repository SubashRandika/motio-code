"use server";

import { revalidatePath } from "next/cache";

import { exportConfigSchema } from "@/core/model";
import { canTransition, type RenderStatus } from "@/core/render";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

import { finishRenderSchema, type FinishRenderInput } from "./schema";

export interface StartRenderResult {
  jobId?: string;
  error?: string;
}

/**
 * Opens a render job.
 *
 * The export settings are read from the stored project rather than taken from
 * the caller: the job row is the record of what was rendered, and a client that
 * could name its own settings could record a render that never happened at
 * settings nobody chose. The browser renders whatever the project says, and this
 * row says the same thing.
 *
 * The job opens as `processing`, not `queued`. The browser starts rendering
 * immediately, so `queued` would be a state no one ever observes; a queue only
 * becomes real with a server-side renderer, and the enum already has the value
 * waiting for it.
 */
export async function startRenderAction(projectId: string): Promise<StartRenderResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, export_config")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (projectError) return { error: `Could not start the export: ${projectError.message}` };
  if (!project) return { error: "That project no longer exists." };

  // A project saved by an older version may predate a field, so it is parsed
  // rather than trusted; defaults fill anything missing.
  const parsed = exportConfigSchema.safeParse(project.export_config ?? {});
  if (!parsed.success) {
    return { error: "This project's export settings are not valid. Open the editor and re-save." };
  }

  const { data: job, error: insertError } = await supabase
    .from("render_jobs")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      status: "processing",
      render_settings: parsed.data,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) return { error: `Could not start the export: ${insertError.message}` };

  return { jobId: job.id };
}

export interface FinishRenderResult {
  ok: boolean;
  error?: string;
}

/**
 * Closes a render job.
 *
 * The transition is checked against the row's current status instead of being
 * written blind, because the browser is the renderer: a tab can be closed
 * mid-render, a retry can report twice, and a cancellation can land after a
 * success. A job that already ended stays as it ended.
 */
export async function finishRenderAction(input: FinishRenderInput): Promise<FinishRenderResult> {
  const user = await requireUser();

  const parsed = finishRenderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That is not a valid outcome." };
  }

  const { jobId, outcome, errorMessage } = parsed.data;
  const supabase = await createClient();

  const { data: job, error: readError } = await supabase
    .from("render_jobs")
    .select("id, status, project_id")
    .eq("id", jobId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (readError) return { ok: false, error: `Could not record the export: ${readError.message}` };
  if (!job) return { ok: false, error: "That export is no longer recorded." };

  if (!canTransition(job.status as RenderStatus, outcome)) {
    // Not an error the user caused, and not worth surfacing: the job already has
    // a final answer, which is what the caller was trying to give it.
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("render_jobs")
    .update({
      status: outcome,
      progress: outcome === "completed" ? 1 : 0,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("owner_id", user.id);

  if (updateError) return { ok: false, error: `Could not record the export: ${updateError.message}` };

  revalidatePath(`/projects/${job.project_id}/settings`);
  return { ok: true };
}
