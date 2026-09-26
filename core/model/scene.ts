import { z } from "zod";

import { transitionSchema } from "./animation";
import { sceneElementSchema } from "./element";
import { frameCountSchema, hexColorSchema, idSchema } from "./primitives";

/**
 * The text definition behind a scene's diagram, when it has one.
 *
 * Text owns the structure, the canvas owns positions. Applying the text adds,
 * removes and relabels nodes; it only places a node the first time it appears.
 */
export const sceneDiagramSchema = z.object({
  source: z.string().max(20000),
  /** Set when the source was last compiled into elements. */
  appliedAt: z.string().nullable().default(null),
});

export type SceneDiagram = z.infer<typeof sceneDiagramSchema>;

/**
 * The JSON payload stored in `project_scenes.scene_data`. Scene identity,
 * name, order and duration live in dedicated columns so the database can index
 * and reorder them; only the element graph is JSON.
 */
export const sceneDataSchema = z.object({
  elements: z.array(sceneElementSchema).max(300).default([]),
  /** How this scene enters from the previous one. */
  transition: transitionSchema.nullable().default(null),
  /** Overrides the project background for this scene only. */
  background: hexColorSchema.nullable().default(null),
  notes: z.string().max(4000).default(""),
  /** Present only for scenes whose diagram was written as text. */
  diagram: sceneDiagramSchema.nullable().default(null),
});

export type SceneData = z.infer<typeof sceneDataSchema>;

export const sceneSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  order: z.number().int().min(0),
  durationInFrames: frameCountSchema.min(1),
  data: sceneDataSchema,
});

export type Scene = z.infer<typeof sceneSchema>;

export const EMPTY_SCENE_DATA: SceneData = {
  elements: [],
  transition: null,
  background: null,
  notes: "",
  diagram: null,
};
