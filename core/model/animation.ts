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

export const animationSchema = z.discriminatedUnion("type", [
  fadeAnimationSchema,
  slideAnimationSchema,
  scaleAnimationSchema,
  highlightAnimationSchema,
  emphasisAnimationSchema,
  revealAnimationSchema,
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
