import { z } from "zod";

import { aspectRatioSchema } from "./canvas";

export const EXPORT_RESOLUTIONS = ["720p", "1080p", "1440p"] as const;
export const exportResolutionSchema = z.enum(EXPORT_RESOLUTIONS);
export type ExportResolution = z.infer<typeof exportResolutionSchema>;

/** Long edge in pixels for each resolution step. */
export const RESOLUTION_LONG_EDGE: Record<ExportResolution, number> = {
  "720p": 1280,
  "1080p": 1920,
  "1440p": 2560,
};

export const exportConfigSchema = z.object({
  format: z.enum(["mp4", "webm", "gif"]).default("mp4"),
  aspectRatio: aspectRatioSchema.default("16:9"),
  resolution: exportResolutionSchema.default("1080p"),
  fps: z.number().int().min(12).max(60).default(30),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
});

export type ExportConfig = z.infer<typeof exportConfigSchema>;

/** Output pixel dimensions for a given export configuration. */
export function exportDimensions(config: ExportConfig): { width: number; height: number } {
  const longEdge = RESOLUTION_LONG_EDGE[config.resolution];
  const [a, b] = config.aspectRatio.split(":").map(Number);
  const isLandscape = a >= b;
  const shortEdge = Math.round((longEdge * Math.min(a, b)) / Math.max(a, b) / 2) * 2;
  return isLandscape
    ? { width: longEdge, height: shortEdge }
    : { width: shortEdge, height: longEdge };
}
