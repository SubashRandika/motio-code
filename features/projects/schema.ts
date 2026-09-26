import { z } from "zod";

import {
  ASPECT_RATIOS,
  CONTENT_TYPES,
  canvasConfigSchema,
  exportConfigSchema,
  sceneDataSchema,
  themeConfigSchema,
} from "@/core/model";

/** Input for the "new project" flow. */
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(120),
  contentType: z.enum(CONTENT_TYPES).default("mixed"),
  aspectRatio: z.enum(ASPECT_RATIOS).default("16:9"),
  fps: z.coerce.number().int().min(12).max(60).default(30),
  /**
   * A starter template's id, or null for a blank project. An id the catalogue
   * does not know is treated as blank rather than rejected: the form is the only
   * thing that supplies it, and a stale one should not block creating a project.
   */
  templateId: z
    .string()
    .max(80)
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .default(null),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const renameProjectSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1, "Give the project a name").max(120),
});

/**
 * What the editor sends when saving. Validated on the server before it
 * reaches the database -- the client is never trusted with the shape of a
 * project, only with the intent to save one.
 */
export const projectSavePayloadSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).nullable(),
  canvas: canvasConfigSchema,
  theme: themeConfigSchema,
  export: exportConfigSchema,
  scenes: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().trim().min(1).max(120),
        order: z.number().int().min(0),
        durationInFrames: z.number().int().min(1).max(108000),
        data: sceneDataSchema,
      }),
    )
    .min(1, "A project needs at least one scene")
    .max(120, "A project is limited to 120 scenes"),
});

export type ProjectSavePayload = z.infer<typeof projectSavePayloadSchema>;
