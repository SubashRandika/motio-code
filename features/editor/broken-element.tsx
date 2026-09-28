"use client";

import type { SceneElement } from "@/core/model";

/**
 * Stands in for an element that threw while drawing.
 *
 * It is placed at the element's own box, so the canvas keeps its shape and the
 * gap is where the element was rather than a hole at the origin. It is also
 * still selectable, which is the point: the way out of a broken element is to
 * select it and fix or delete it, and a fallback that could not be clicked
 * would leave the user with a canvas they cannot repair.
 *
 * Deliberately loud. A quiet fallback would leave someone wondering why their
 * export is missing a box.
 */
export function BrokenElement({ element }: { element: SceneElement }) {
  return (
    <div
      data-element-id={element.id}
      data-broken-element
      role="img"
      aria-label={`${element.name} could not be drawn`}
      style={{
        position: "absolute",
        left: element.rect.x,
        top: element.rect.y,
        width: element.rect.width,
        height: element.rect.height,
        display: "grid",
        placeItems: "center",
        padding: 8,
        border: "2px dashed var(--color-danger)",
        borderRadius: 6,
        backgroundColor: "var(--color-danger-wash)",
        color: "var(--color-danger)",
        fontFamily: "var(--font-jetbrains)",
        fontSize: 12,
        lineHeight: 1.4,
        textAlign: "center",
        overflow: "hidden",
        cursor: "move",
      }}
    >
      <span>
        {element.name} could not be drawn
        <br />
        <span style={{ opacity: 0.8 }}>Select it to fix or delete it.</span>
      </span>
    </div>
  );
}
