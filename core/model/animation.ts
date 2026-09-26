import { z } from "zod";

import { frameCountSchema, hexColorSchema, idSchema } from "./primitives";

export const EASINGS = ["linear", "easeIn", "easeOut", "easeInOut", "anticipate"] as const;
export const easingSchema = z.enum(EASINGS);
export type Easing = z.infer<typeof easingSchema>;

export const DIRECTIONS = ["up", "down", "left", "right"] as const;
export const directionSchema = z.enum(DIRECTIONS);

/**
 * When an animation runs relative to its element.
 * - `enter` plays from the element's first frame.
 * - `exit`  plays so that it finishes on the element's last frame.
 * - `at`    plays at an explicit offset inside the element.
 */
export const animationTriggerSchema = z.enum(["enter", "exit", "at"]);
export type AnimationTrigger = z.infer<typeof animationTriggerSchema>;

const baseAnimation = {
  id: idSchema,
  trigger: animationTriggerSchema.default("enter"),
  /** Offset in frames from the trigger point. Ignored for `exit`. */
  offsetInFrames: frameCountSchema.default(0),
  durationInFrames: frameCountSchema.min(1).default(20),
  easing: easingSchema.default("easeOut"),
};

export const fadeAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("fade"),
  from: z.number().min(0).max(1).default(0),
  to: z.number().min(0).max(1).default(1),
});

export const slideAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("slide"),
  direction: directionSchema.default("up"),
  /** Travel distance in canvas units. */
  distance: z.number().min(0).max(10000).default(48),
});

export const scaleAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("scale"),
  from: z.number().min(0).max(10).default(0.92),
  to: z.number().min(0).max(10).default(1),
});

export const highlightAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("highlight"),
  color: hexColorSchema.default("#F2A63B"),
  /** Peak strength of the highlight, 0-1. Eases in and back out. */
  intensity: z.number().min(0).max(1).default(0.6),
});

export const emphasisAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("emphasis"),
  /** Peak scale during the pulse. */
  peak: z.number().min(1).max(3).default(1.06),
});

/**
 * Progressive reveal of an element's own parts (code lines, list items,
 * diagram nodes). The element decides what a "part" is; the engine only
 * produces a 0-1 progress value and the per-part stagger.
 */
export const revealAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("reveal"),
  staggerInFrames: frameCountSchema.max(600).default(4),
});

/**
 * A marker travelling along a diagram connector: the "data moving between
 * nodes" case. Only connectors read it.
 */
export const flowAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("flow"),
  durationInFrames: frameCountSchema.min(1).default(60),
  /** Markers in flight at once, evenly spaced along the route. */
  markers: z.number().int().min(1).max(6).default(1),
  /** Traversals of the route inside the window. */
  repeat: z.number().int().min(1).max(20).default(1),
  color: hexColorSchema.default("#57D2E0"),
  /** Marker diameter in canvas units. */
  size: z.number().min(2).max(64).default(12),
});

/**
 * Draws attention to a range of an element's own parts -- code lines today,
 * list rows later -- by dimming everything outside the range.
 *
 * The engine only names a range and a dim factor; the element decides what a
 * "part" is, exactly as it does for `reveal`. Several focus animations on one
 * element form a walkthrough: the one whose window has most recently started
 * is the one in force.
 */
export const focusAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("focus"),
  durationInFrames: frameCountSchema.min(1).default(12),
  /** 1-based, inclusive. */
  fromPart: z.number().int().min(1).max(2000).default(1),
  toPart: z.number().int().min(1).max(2000).default(1),
  /** Opacity of the parts outside the range once the focus is fully in. */
  dim: z.number().min(0).max(1).default(0.25),
  accent: hexColorSchema.default("#F2A63B"),
});

/**
 * Counts an element's numeric content towards its stored value.
 *
 * It carries no target of its own -- only progress. The element multiplies its
 * own data by that progress, so what the viewer reads at the end of the
 * animation is exactly what is stored. An animation that carried its own `to`
 * could drift from the data it claims to show.
 */
export const countAnimationSchema = z.object({
  ...baseAnimation,
  type: z.literal("count"),
  durationInFrames: frameCountSchema.min(1).default(45),
  easing: easingSchema.default("easeOut"),
});

export const animationSchema = z.discriminatedUnion("type", [
  fadeAnimationSchema,
  slideAnimationSchema,
  scaleAnimationSchema,
  highlightAnimationSchema,
  emphasisAnimationSchema,
  revealAnimationSchema,
  flowAnimationSchema,
  focusAnimationSchema,
  countAnimationSchema,
]);

export type Animation = z.infer<typeof animationSchema>;
export type AnimationType = Animation["type"];

export const ANIMATION_TYPES: AnimationType[] = [
  "fade",
  "slide",
  "scale",
  "highlight",
  "emphasis",
  "reveal",
  "flow",
  "focus",
  "count",
];

/** How a scene enters from the one before it. */
export const transitionSchema = z.object({
  type: z.enum(["cut", "fade", "slide", "wipe"]).default("cut"),
  durationInFrames: frameCountSchema.max(300).default(0),
  direction: directionSchema.default("left"),
  easing: easingSchema.default("easeInOut"),
});

export type Transition = z.infer<typeof transitionSchema>;

export const CUT_TRANSITION: Transition = {
  type: "cut",
  durationInFrames: 0,
  direction: "left",
  easing: "easeInOut",
};
