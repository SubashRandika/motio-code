import type { SceneElement } from "@/core/model";

/**
 * Layer numbering.
 *
 * Two functions rather than one, because the difference is the whole point and
 * getting it wrong is silent: a reorder that re-sorts before renumbering undoes
 * the move it was asked to make.
 */

/**
 * Numbers layers from the array's own order.
 *
 * The caller has already put the elements where it wants them -- after a
 * reorder, or when building a scene from scratch -- so this must not re-sort.
 */
export function assignLayers(elements: SceneElement[]): SceneElement[] {
  return elements.map((element, index) => ({ ...element, layer: index }));
}

/**
 * Closes gaps in the layer numbers after an add or a delete, keeping the
 * existing stacking order.
 */
export function relayer(elements: SceneElement[]): SceneElement[] {
  return assignLayers([...elements].sort((a, b) => a.layer - b.layer));
}
