import type { Animation } from "@/core/model/animation";
import type { SceneElement } from "@/core/model/element";

import { applyEasing, clamp01 } from "./easing";

/**
 * Everything a renderer needs to draw one element at one frame.
 *
 * Composition rules when several animations overlap:
 * - `opacity` multiplies, so two fades compound rather than fight.
 * - `translateX` / `translateY` accumulate.
 * - `scale` multiplies.
 * - `highlight` takes the strongest active highlight.
 * - `revealProgress` takes the most restrictive (smallest) value.
 *
 * Outside an animation's window the element holds that animation's start value
 * (before) or end value (after), so state is defined at every frame.
 */
export interface ElementRenderState {
  visible: boolean;
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  highlight: { color: string; strength: number } | null;
  /** 0-1 progress for progressive reveals (code lines, list items, nodes). */
  revealProgress: number;
  /** Frames between consecutive parts of a progressive reveal. */
  revealStaggerInFrames: number;
}

const IDENTITY: ElementRenderState = {
  visible: true,
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  highlight: null,
  revealProgress: 1,
  revealStaggerInFrames: 0,
};

/** Last frame of an element, exclusive. `null` duration runs to the scene end. */
export function elementEndFrame(element: SceneElement, sceneDurationInFrames: number): number {
  return element.durationInFrames === null
    ? sceneDurationInFrames
    : Math.min(element.from + element.durationInFrames, sceneDurationInFrames);
}

export function isElementVisible(
  element: SceneElement,
  sceneFrame: number,
  sceneDurationInFrames: number,
): boolean {
  if (element.hidden) return false;
  return sceneFrame >= element.from && sceneFrame < elementEndFrame(element, sceneDurationInFrames);
}

interface AnimationWindow {
  start: number;
  end: number;
}

/** Where an animation sits on the element's local frame axis. */
export function animationWindow(
  animation: Animation,
  element: SceneElement,
  sceneDurationInFrames: number,
): AnimationWindow {
  const end = elementEndFrame(element, sceneDurationInFrames);

  if (animation.trigger === "exit") {
    const exitStart = Math.max(element.from, end - animation.durationInFrames);
    return { start: exitStart, end };
  }

  const start = element.from + animation.offsetInFrames;
  return { start, end: start + animation.durationInFrames };
}

/**
 * Eased 0-1 progress for an animation at a scene-local frame.
 *
 * Exit animations run the same curve in reverse, so a preset written as
 * "0 to 1" reads as an entrance and, reused as an exit, plays as "1 to 0".
 */
export function animationProgress(
  animation: Animation,
  element: SceneElement,
  sceneFrame: number,
  sceneDurationInFrames: number,
): number {
  const { start, end } = animationWindow(animation, element, sceneDurationInFrames);
  const span = end - start;
  const raw = span <= 0 ? (sceneFrame < start ? 0 : 1) : clamp01((sceneFrame - start) / span);
  const eased = applyEasing(raw, animation.easing);
  return animation.trigger === "exit" ? 1 - eased : eased;
}

function slideOffset(
  direction: "up" | "down" | "left" | "right",
  distance: number,
): { x: number; y: number } {
  switch (direction) {
    case "up":
      return { x: 0, y: distance };
    case "down":
      return { x: 0, y: -distance };
    case "left":
      return { x: distance, y: 0 };
    case "right":
      return { x: -distance, y: 0 };
  }
}

/** Resolve one element to a concrete render state at a scene-local frame. */
export function resolveElementState(
  element: SceneElement,
  sceneFrame: number,
  sceneDurationInFrames: number,
): ElementRenderState {
  const visible = isElementVisible(element, sceneFrame, sceneDurationInFrames);
  const state: ElementRenderState = {
    ...IDENTITY,
    visible,
    opacity: element.style.opacity,
  };

  if (!visible) {
    return { ...state, opacity: 0 };
  }

  for (const animation of element.animations) {
    const progress = animationProgress(animation, element, sceneFrame, sceneDurationInFrames);

    switch (animation.type) {
      case "fade": {
        state.opacity *= animation.from + (animation.to - animation.from) * progress;
        break;
      }
      case "slide": {
        // Full offset at progress 0, settled at progress 1.
        const offset = slideOffset(animation.direction, animation.distance * (1 - progress));
        state.translateX += offset.x;
        state.translateY += offset.y;
        break;
      }
      case "scale": {
        state.scale *= animation.from + (animation.to - animation.from) * progress;
        break;
      }
      case "emphasis": {
        // Symmetric pulse: identity at both ends, peak in the middle.
        state.scale *= 1 + (animation.peak - 1) * Math.sin(Math.PI * progress);
        break;
      }
      case "highlight": {
        const strength = animation.intensity * Math.sin(Math.PI * progress);
        if (!state.highlight || strength > state.highlight.strength) {
          state.highlight = { color: animation.color, strength };
        }
        break;
      }
      case "reveal": {
        state.revealProgress = Math.min(state.revealProgress, progress);
        state.revealStaggerInFrames = Math.max(
          state.revealStaggerInFrames,
          animation.staggerInFrames,
        );
        break;
      }
    }
  }

  state.opacity = clamp01(state.opacity);
  state.scale = Math.max(0, state.scale);
  return state;
}

/**
 * How many of `partCount` parts are shown by a progressive reveal, and how far
 * the next one has come in. Used by code line reveals and staggered lists.
 */
export function resolveReveal(
  state: ElementRenderState,
  partCount: number,
): { shown: number; partialProgress: number } {
  if (partCount <= 0) return { shown: 0, partialProgress: 0 };
  if (state.revealProgress >= 1) return { shown: partCount, partialProgress: 1 };

  const exact = state.revealProgress * partCount;
  const shown = Math.floor(exact);
  return { shown, partialProgress: exact - shown };
}
