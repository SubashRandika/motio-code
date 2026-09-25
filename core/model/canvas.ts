import { z } from "zod";

import { hexColorSchema } from "./primitives";

export const ASPECT_RATIOS = ["16:9", "1:1", "9:16", "4:5"] as const;
export const aspectRatioSchema = z.enum(ASPECT_RATIOS);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

/** Design resolution per aspect ratio. Output resolution is an export concern. */
export const CANVAS_PRESETS: Record<
  AspectRatio,
  { width: number; height: number; label: string; use: string }
> = {
  "16:9": { width: 1920, height: 1080, label: "Landscape", use: "YouTube, docs, slides" },
  "1:1": { width: 1080, height: 1080, label: "Square", use: "LinkedIn, X" },
  "9:16": { width: 1080, height: 1920, label: "Portrait", use: "Shorts, Reels, TikTok" },
  "4:5": { width: 1080, height: 1350, label: "Tall", use: "LinkedIn, Instagram feed" },
};

export const FPS_OPTIONS = [24, 30, 60] as const;

export const canvasConfigSchema = z.object({
  aspectRatio: aspectRatioSchema.default("16:9"),
  width: z.number().int().min(240).max(7680).default(1920),
  height: z.number().int().min(240).max(7680).default(1080),
  fps: z.number().int().min(12).max(60).default(30),
  background: hexColorSchema.default("#0E1116"),
});

export type CanvasConfig = z.infer<typeof canvasConfigSchema>;

export function canvasForAspectRatio(aspectRatio: AspectRatio, fps = 30): CanvasConfig {
  const preset = CANVAS_PRESETS[aspectRatio];
  return {
    aspectRatio,
    width: preset.width,
    height: preset.height,
    fps,
    background: "#0E1116",
  };
}
