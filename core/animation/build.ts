import { createId, type Animation, type AnimationTrigger, type Easing } from "@/core/model";

/**
 * Constructors for animations, used wherever code writes an animation rather
 * than a user adding one: the presets and the starter templates.
 *
 * `createAnimation(type)` in the model gives a *default* animation for the
 * properties panel to then edit. These take the values the caller actually wants,
 * so nothing has to construct a default and immediately overwrite half of it.
 * One home for them means a preset and a template cannot disagree about what a
 * fade is.
 */

interface Timing {
  trigger?: AnimationTrigger;
  offsetInFrames?: number;
  easing?: Easing;
}

/** Whole frames, never below one -- a zero-length window has no progress. */
function frames(value: number): number {
  return Math.max(1, Math.round(value));
}

function offset(timing: Timing): number {
  return Math.max(0, Math.round(timing.offsetInFrames ?? 0));
}

export function fadeIn(durationInFrames: number, timing: Timing = {}): Animation {
  return {
    id: createId("an"),
    type: "fade",
    trigger: timing.trigger ?? "enter",
    offsetInFrames: offset(timing),
    durationInFrames: frames(durationInFrames),
    easing: timing.easing ?? "easeOut",
    from: 0,
    to: 1,
  };
}

/** A fade written as an exit, which the engine runs in reverse: 1 to 0. */
export function fadeOut(durationInFrames: number, timing: Timing = {}): Animation {
  return fadeIn(durationInFrames, { ...timing, trigger: "exit" });
}

export function slideFrom(
  direction: "up" | "down" | "left" | "right",
  durationInFrames: number,
  distance: number,
  timing: Timing = {},
): Animation {
  return {
    id: createId("an"),
    type: "slide",
    trigger: timing.trigger ?? "enter",
    offsetInFrames: offset(timing),
    durationInFrames: frames(durationInFrames),
    easing: timing.easing ?? "easeOut",
    direction,
    distance: Math.max(0, distance),
  };
}

export function scaleIn(
  durationInFrames: number,
  from: number,
  timing: Timing = {},
): Animation {
  return {
    id: createId("an"),
    type: "scale",
    trigger: timing.trigger ?? "enter",
    offsetInFrames: offset(timing),
    durationInFrames: frames(durationInFrames),
    easing: timing.easing ?? "easeOut",
    from,
    to: 1,
  };
}

/**
 * A progressive reveal of an element's own parts.
 *
 * Linear by default, always: an eased reveal types quickly and then crawls.
 */
export function revealParts(
  durationInFrames: number,
  staggerInFrames = 0,
  timing: Timing = {},
): Animation {
  return {
    id: createId("an"),
    type: "reveal",
    trigger: timing.trigger ?? "enter",
    offsetInFrames: offset(timing),
    durationInFrames: frames(durationInFrames),
    easing: timing.easing ?? "linear",
    staggerInFrames: Math.max(0, Math.round(staggerInFrames)),
  };
}

export function focusRange(options: {
  fromPart: number;
  toPart: number;
  offsetInFrames: number;
  durationInFrames: number;
  dim?: number;
  accent: string;
  trigger?: AnimationTrigger;
}): Animation {
  return {
    id: createId("an"),
    type: "focus",
    trigger: options.trigger ?? "at",
    offsetInFrames: Math.max(0, Math.round(options.offsetInFrames)),
    durationInFrames: frames(options.durationInFrames),
    easing: "easeOut",
    fromPart: Math.max(1, Math.round(options.fromPart)),
    toPart: Math.max(1, Math.round(options.toPart)),
    dim: options.dim ?? 0.2,
    accent: options.accent,
  };
}

export function countUp(durationInFrames: number, timing: Timing = {}): Animation {
  return {
    id: createId("an"),
    type: "count",
    trigger: timing.trigger ?? "enter",
    offsetInFrames: offset(timing),
    durationInFrames: frames(durationInFrames),
    easing: timing.easing ?? "easeOut",
  };
}

export function emphasise(
  durationInFrames: number,
  peak: number,
  timing: Timing = {},
): Animation {
  return {
    id: createId("an"),
    type: "emphasis",
    trigger: timing.trigger ?? "at",
    offsetInFrames: offset(timing),
    durationInFrames: frames(durationInFrames),
    easing: timing.easing ?? "easeInOut",
    peak,
  };
}

export function highlight(options: {
  durationInFrames: number;
  offsetInFrames?: number;
  color: string;
  intensity?: number;
}): Animation {
  return {
    id: createId("an"),
    type: "highlight",
    trigger: "at",
    offsetInFrames: Math.max(0, Math.round(options.offsetInFrames ?? 0)),
    durationInFrames: frames(options.durationInFrames),
    easing: "easeInOut",
    color: options.color,
    intensity: options.intensity ?? 0.6,
  };
}

/** A marker travelling a connector. Only a connector reads it. */
export function flowAlong(options: {
  durationInFrames: number;
  offsetInFrames?: number;
  color: string;
  markers?: number;
  repeat?: number;
  size?: number;
}): Animation {
  return {
    id: createId("an"),
    type: "flow",
    trigger: "at",
    offsetInFrames: Math.max(0, Math.round(options.offsetInFrames ?? 0)),
    durationInFrames: frames(options.durationInFrames),
    easing: "linear",
    markers: options.markers ?? 1,
    repeat: options.repeat ?? 1,
    color: options.color,
    size: options.size ?? 12,
  };
}
