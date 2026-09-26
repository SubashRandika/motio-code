import { resolveReveal, type ElementRenderState } from "@/core/animation";
import type { ChartBar } from "@/core/model";

/**
 * How an infographic element turns its stored data into what is drawn at a
 * frame.
 *
 * Two independent axes, which is why they are two animation types rather than
 * one:
 *
 * - **`count` animates magnitude.** `valueProgress` scales every number towards
 *   its stored value, all together.
 * - **`reveal` animates presence.** Parts arrive in sequence, and the one in
 *   flight is drawn part-way rather than popped in, so a bar grows.
 *
 * Their product is a part's factor, so the two compose without a special case:
 * with neither animation every factor is 1 and the element shows the true data.
 */

/** A part's 0-1 factor from a staggered reveal, or 1 for every part if none. */
export function partFactors(state: ElementRenderState, partCount: number): number[] {
  if (partCount <= 0) return [];

  const { shown, partialProgress } = resolveReveal(state, partCount);

  return Array.from({ length: partCount }, (_, index) =>
    index < shown ? 1 : index === shown ? partialProgress : 0,
  );
}

/** What a single-valued element (a counter, a progress bar) shows at a frame. */
export function animatedValue(value: number, state: ElementRenderState): number {
  return value * state.valueProgress * (partFactors(state, 1)[0] ?? 1);
}

/**
 * The value a full-length bar or a complete ring stands for.
 *
 * `null` scales to the data, and a floor of 1 keeps an all-zero chart from
 * dividing by zero and drawing bars of infinite length.
 */
export function chartMax(bars: readonly ChartBar[], declared: number | null): number {
  if (declared !== null && declared > 0) return declared;

  const largest = bars.reduce((max, bar) => Math.max(max, Math.abs(bar.value)), 0);
  return largest > 0 ? largest : 1;
}

export interface ChartBarLayout {
  /** The bar's true value, for the label. */
  value: number;
  /** The value reached at this frame, which is what the label must show. */
  shownValue: number;
  /** 0-1 of the axis, already including the animation. */
  fraction: number;
  color: string | null;
  label: string;
}

/**
 * Lays out a bar chart at one frame.
 *
 * `shownValue` and `fraction` are derived from the same number, so the label can
 * never disagree with the bar beside it.
 */
export function chartLayout(
  bars: readonly ChartBar[],
  declaredMax: number | null,
  state: ElementRenderState,
): ChartBarLayout[] {
  const max = chartMax(bars, declaredMax);
  const factors = partFactors(state, bars.length);

  return bars.map((bar, index) => {
    const shownValue = bar.value * state.valueProgress * factors[index];

    return {
      value: bar.value,
      shownValue,
      fraction: Math.max(0, Math.min(1, Math.abs(shownValue) / max)),
      color: bar.color,
      label: bar.label,
    };
  });
}

/** 0-1 of a progress indicator at one frame, clamped so it cannot overflow. */
export function progressFraction(
  value: number,
  max: number,
  state: ElementRenderState,
): { fraction: number; shownValue: number } {
  const shownValue = animatedValue(value, state);
  const safeMax = max > 0 ? max : 1;

  return { fraction: Math.max(0, Math.min(1, shownValue / safeMax)), shownValue };
}
