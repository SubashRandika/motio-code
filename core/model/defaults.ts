import { canvasForAspectRatio, type AspectRatio } from "./canvas";
import { exportConfigSchema } from "./export";
import { createUuid } from "./primitives";
import { EMPTY_SCENE_DATA, type Scene } from "./scene";
import { BUILT_IN_THEMES, type ThemeConfig } from "./theme";
import type { ContentType } from "./project";

export const DEFAULT_SCENE_DURATION_IN_FRAMES = 150; // 5s at 30fps
export const DEFAULT_THEME: ThemeConfig = BUILT_IN_THEMES[0];

export function createScene(order: number, name?: string): Scene {
  return {
    // Scene ids are uuids because scenes are rows, not JSON.
    id: createUuid(),
    name: name ?? `Scene ${order + 1}`,
    order,
    durationInFrames: DEFAULT_SCENE_DURATION_IN_FRAMES,
    data: { ...EMPTY_SCENE_DATA, elements: [] },
  };
}

export function createBlankProjectDraft(options: {
  name: string;
  contentType: ContentType;
  aspectRatio: AspectRatio;
  fps?: number;
}) {
  const canvas = canvasForAspectRatio(options.aspectRatio, options.fps ?? 30);
  return {
    name: options.name,
    contentType: options.contentType,
    canvas,
    theme: DEFAULT_THEME,
    export: exportConfigSchema.parse({
      aspectRatio: options.aspectRatio,
      fps: canvas.fps,
    }),
    scenes: [createScene(0, "Opening")],
  };
}
