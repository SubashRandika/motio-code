import type { Easing } from "@/core/model/animation";

/**
 * Pure easing functions over a normalised 0-1 input. Deterministic by design:
 * the same frame always produces the same value, in the editor preview and in
 * a headless render alike.
 */
export const EASING_FUNCTIONS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  // Pulls back slightly before moving, then settles without overshooting past 1.
  anticipate: (t) => {
    const c = 1.70158;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
  },
};

export function applyEasing(t: number, easing: Easing): number {
  return EASING_FUNCTIONS[easing](clamp01(t));
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
