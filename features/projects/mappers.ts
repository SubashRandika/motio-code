import { pruneDanglingConnectors } from "@/core/diagram";
import {
  canvasConfigSchema,
  exportConfigSchema,
  sceneDataSchema,
  themeConfigSchema,
  type CanvasConfig,
  type ExportConfig,
  type Project,
  type ProjectMeta,
  type Scene,
  type SceneData,
  type ThemeConfig,
} from "@/core/model";
import type { Tables } from "@/lib/supabase/database.types";

type ProjectRow = Tables<"projects">;
type SceneRow = Tables<"project_scenes">;

/**
 * Stored JSON is user-influenced and may predate the current schema, so every
 * blob is validated on the way in. A blob that fails validation falls back to
 * defaults rather than breaking the editor -- the user keeps their scenes even
 * if one config is corrupt.
 */
function parseOrDefault<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  value: unknown,
  fallback: T,
): T {
  const result = schema.safeParse(value ?? {});
  return result.success && result.data !== undefined ? result.data : fallback;
}

export function rowToCanvas(row: ProjectRow): CanvasConfig {
  return parseOrDefault(canvasConfigSchema, row.canvas_config, canvasConfigSchema.parse({}));
}

export function rowToTheme(row: ProjectRow): ThemeConfig {
  return parseOrDefault(themeConfigSchema, row.theme_config, themeConfigSchema.parse({}));
}

export function rowToExport(row: ProjectRow): ExportConfig {
  return parseOrDefault(exportConfigSchema, row.export_config, exportConfigSchema.parse({}));
}

export function rowToProjectMeta(row: ProjectRow): ProjectMeta {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    contentType: row.content_type,
    templateId: row.template_id,
    thumbnailPath: row.thumbnail_path,
    dataVersion: row.data_version,
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToSceneData(value: unknown): SceneData {
  const data = parseOrDefault(sceneDataSchema, value, sceneDataSchema.parse({}));
  // Defence in depth: a scene edited through the configuration panel, or saved
  // by an older build, could name a connector endpoint that no longer exists.
  return { ...data, elements: pruneDanglingConnectors(data.elements) };
}

export function rowToScene(row: SceneRow): Scene {
  return {
    id: row.id,
    name: row.name,
    order: row.scene_order,
    durationInFrames: row.duration_in_frames,
    data: rowToSceneData(row.scene_data),
  };
}

export function rowsToProject(project: ProjectRow, scenes: SceneRow[]): Project {
  return {
    ...rowToProjectMeta(project),
    canvas: rowToCanvas(project),
    theme: rowToTheme(project),
    export: rowToExport(project),
    scenes: scenes
      .map(rowToScene)
      .sort((a, b) => a.order - b.order),
  };
}
