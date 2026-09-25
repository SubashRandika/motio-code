import type { Easing } from "@/core/model/animation";

import { applyEasing, clamp } from "./easing";

export interface InterpolateOptions {
  easing?: Easing;
  /** Clamp the output to the output range. On by default. */
  clamp?: boolean;
}

/**
 * Maps a frame from an input range onto an output range.
 *
 * The single primitive every animation is built from. Keep it free of any
 * browser or React dependency so the same call produces the same number during
 * a server-side render.
 */
export function interpolate(
  input: number,
  inputRange: readonly [number, number],
  outputRange: readonly [number, number],
  options: InterpolateOptions = {},
): number {
  const [inputStart, inputEnd] = inputRange;
  const [outputStart, outputEnd] = outputRange;
  const shouldClamp = options.clamp ?? true;

  // A zero-length input range is a step change at inputStart.
  if (inputEnd === inputStart) {
    return input < inputStart ? outputStart : outputEnd;
  }

  let progress = (input - inputStart) / (inputEnd - inputStart);
  if (shouldClamp) progress = clamp(progress, 0, 1);
  if (options.easing) progress = applyEasing(progress, options.easing);

  const value = outputStart + (outputEnd - outputStart) * progress;
  if (!shouldClamp) return value;

  const lower = Math.min(outputStart, outputEnd);
  const upper = Math.max(outputStart, outputEnd);
  return clamp(value, lower, upper);
}

/** Frames to seconds at a given frame rate. */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

/** Seconds to whole frames at a given frame rate. */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/** `mm:ss:ff` timecode for timeline rulers and frame readouts. */
export function formatTimecode(frame: number, fps: number): string {
  const safeFrame = Math.max(0, Math.floor(frame));
  const totalSeconds = Math.floor(safeFrame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = safeFrame % fps;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}
