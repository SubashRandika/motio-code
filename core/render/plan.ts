import { buildTimeline } from "@/core/animation";
import { exportDimensions, type ExportConfig, type Project } from "@/core/model";

/**
 * The id every MotioCode composition is registered under.
 *
 * One composition serves every project: the project arrives as input props
 * rather than as generated code, so nothing has to be written to disk or
 * bundled per render.
 */
export const COMPOSITION_ID = "MotioCodeProject";

export interface RenderPlan {
  compositionId: string;
  /** Output pixel dimensions. */
  width: number;
  height: number;
  /** Output frame rate, which may differ from the frame rate authored against. */
  fps: number;
  durationInFrames: number;
  /** The resolution the project was composed at. */
  canvasWidth: number;
  canvasHeight: number;
  /** Uniform canvas-pixel to output-pixel scale. */
  scale: number;
  /** Offset that centres the scaled canvas in the output. */
  offsetX: number;
  offsetY: number;
  /** Output frames per authored frame; 1 when the frame rates match. */
  frameRatio: number;
  /** True when the output shape differs from the canvas, so bars are visible. */
  letterboxed: boolean;
}

/**
 * Maps a project onto the composition that renders it.
 *
 * Two decisions are worth stating, because both could reasonably have gone the
 * other way:
 *
 * 1. **The canvas is never cropped.** When the export aspect ratio differs from
 *    the one the project was composed at, the canvas is scaled to fit and
 *    centred, leaving bars. Cropping would silently cut away work the user
 *    arranged deliberately, and the canvas is the thing they arranged it on.
 *    Matching the export ratio to the canvas produces no bars at all, which is
 *    why it is the default.
 * 2. **Changing the export frame rate resamples, it does not retime.** The
 *    timeline is authored in canvas frames; asking for 60fps output must produce
 *    the same number of *seconds*, at twice the frames, not a video that plays
 *    at half speed. Because every element is a pure function of a frame number,
 *    resampling is just arithmetic -- `canvasFrameFor` converts an output frame
 *    back to the authored frame it should draw.
 */
export function planRender(project: Project, config: ExportConfig): RenderPlan {
  const { width, height } = exportDimensions(config);
  const canvasWidth = project.canvas.width;
  const canvasHeight = project.canvas.height;

  const scale = Math.min(width / canvasWidth, height / canvasHeight);
  const drawnWidth = canvasWidth * scale;
  const drawnHeight = canvasHeight * scale;

  const authoredFrames = buildTimeline(project.scenes).durationInFrames;
  const frameRatio = config.fps / project.canvas.fps;

  // Remotion rejects a composition shorter than a single frame, and an empty
  // project is a normal thing to ask to preview.
  const durationInFrames = Math.max(1, Math.round(authoredFrames * frameRatio));

  return {
    compositionId: COMPOSITION_ID,
    width,
    height,
    fps: config.fps,
    durationInFrames,
    canvasWidth,
    canvasHeight,
    scale,
    offsetX: (width - drawnWidth) / 2,
    offsetY: (height - drawnHeight) / 2,
    frameRatio,
    // A sub-pixel difference is rounding, not a bar.
    letterboxed: width - drawnWidth >= 1 || height - drawnHeight >= 1,
  };
}

/**
 * The authored frame an output frame should draw.
 *
 * Runs per frame during a render, so it stays arithmetic: no allocation, no
 * lookup, and the same answer for the same input every time.
 */
export function canvasFrameFor(plan: RenderPlan, outputFrame: number): number {
  if (plan.frameRatio === 1) return outputFrame;
  return Math.round(outputFrame / plan.frameRatio);
}

/** Seconds of output, for the UI to state before anyone waits for a render. */
export function renderDurationInSeconds(plan: RenderPlan): number {
  return plan.durationInFrames / plan.fps;
}
