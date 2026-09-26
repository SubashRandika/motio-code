import "server-only";

import { exportConfigSchema, type ExportConfig } from "@/core/model";
import type { RenderStatus } from "@/core/render";
import { createClient } from "@/lib/supabase/server";

export interface RenderJobSummary {
  id: string;
  status: RenderStatus;
  /** What was asked for, as recorded when the job opened. */
  settings: ExportConfig | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Export history for one project, most recent first.
 *
 * With download-only exports there is no file to hand back, so this answers
 * "what have I exported, and did it work" rather than "where is my file".
 * Settings that no longer parse come back as null instead of throwing: a history
 * list is not worth failing a page load over.
 */
export async function listRenderJobs(
  projectId: string,
  ownerId: string,
  limit = 10,
): Promise<RenderJobSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("render_jobs")
    .select("id, status, render_settings, error_message, created_at, completed_at")
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load the export history: ${error.message}`);

  return (data ?? []).map((row) => {
    const settings = exportConfigSchema.safeParse(row.render_settings ?? {});

    return {
      id: row.id,
      status: row.status,
      settings: settings.success ? settings.data : null,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  });
}
