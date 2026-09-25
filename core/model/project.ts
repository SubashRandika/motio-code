import { z } from "zod";

import { canvasConfigSchema } from "./canvas";
import { exportConfigSchema } from "./export";
import { sceneSchema } from "./scene";
import { themeConfigSchema } from "./theme";

export const CONTENT_TYPES = ["code", "diagram", "infographic", "mixed"] as const;
export const contentTypeSchema = z.enum(CONTENT_TYPES);
export type ContentType = z.infer<typeof contentTypeSchema>;

/** Bumped whenever a stored shape changes in a way that needs migrating. */
export const PROJECT_DATA_VERSION = 1;

export const projectMetaSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  name: z.string().trim().min(1, "Give the project a name").max(120),
  description: z.string().max(1000).nullable().default(null),
  contentType: contentTypeSchema,
  templateId: z.string().max(80).nullable().default(null),
  thumbnailPath: z.string().max(2048).nullable().default(null),
  dataVersion: z.number().int().min(1).default(PROJECT_DATA_VERSION),
  lastOpenedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectMeta = z.infer<typeof projectMetaSchema>;

/** The full project, as the editor and the renderer both consume it. */
export const projectSchema = projectMetaSchema.extend({
  canvas: canvasConfigSchema,
  theme: themeConfigSchema,
  export: exportConfigSchema,
  scenes: z.array(sceneSchema).min(1).max(120),
});

export type Project = z.infer<typeof projectSchema>;

/** Shape shown on the dashboard: everything except the scene graph. */
export type ProjectSummary = ProjectMeta & {
  canvas: z.infer<typeof canvasConfigSchema>;
  sceneCount: number;
};
