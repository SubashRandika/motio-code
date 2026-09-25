"use client";

import { RESIZE_HANDLES, boundingRect, type ResizeHandle, type SnapGuide } from "@/core/editing";
import type { Rect, SceneElement } from "@/core/model";

/** Where each handle sits on the element's box, as a 0-1 fraction. */
const HANDLE_POSITION: Record<ResizeHandle, { x: number; y: number; cursor: string }> = {
  nw: { x: 0, y: 0, cursor: "nwse-resize" },
  n: { x: 0.5, y: 0, cursor: "ns-resize" },
  ne: { x: 1, y: 0, cursor: "nesw-resize" },
  e: { x: 1, y: 0.5, cursor: "ew-resize" },
  se: { x: 1, y: 1, cursor: "nwse-resize" },
  s: { x: 0.5, y: 1, cursor: "ns-resize" },
  sw: { x: 0, y: 1, cursor: "nesw-resize" },
  w: { x: 0, y: 0.5, cursor: "ew-resize" },
};

/**
 * Selection chrome, drawn in display pixels on top of the scaled stage.
 *
 * Keeping it out of the scaled layer is what keeps handles and outlines the
 * same physical size at every zoom level.
 */
export function SelectionOverlay({
  elements,
  scale,
  marquee,
  guides,
  canvasWidth,
  canvasHeight,
  dragging,
}: {
  elements: SceneElement[];
  scale: number;
  marquee: Rect | null;
  guides: SnapGuide[];
  canvasWidth: number;
  canvasHeight: number;
  dragging: boolean;
}) {
  const bounds = boundingRect(elements.map((element) => element.rect));
  const single = elements.length === 1 ? elements[0] : null;
  // Handles belong to a single element; a multi-selection shows its extent only.
  const handleTarget = single && !single.locked ? single : null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {guides.map((guide, index) => (
        <div
          key={`${guide.axis}-${guide.position}-${index}`}
          className={guide.source === "canvas" ? "absolute bg-amber/80" : "absolute bg-cyan/80"}
          style={
            guide.axis === "x"
              ? { left: guide.position * scale, top: 0, width: 1, height: canvasHeight * scale }
              : { top: guide.position * scale, left: 0, height: 1, width: canvasWidth * scale }
          }
        />
      ))}

      {elements.map((element) => (
        <div
          key={element.id}
          className="absolute border border-amber"
          style={{
            left: element.rect.x * scale,
            top: element.rect.y * scale,
            width: element.rect.width * scale,
            height: element.rect.height * scale,
          }}
        />
      ))}

      {bounds && elements.length > 1 ? (
        <div
          className="absolute border border-dashed border-amber/50"
          style={{
            left: bounds.x * scale,
            top: bounds.y * scale,
            width: bounds.width * scale,
            height: bounds.height * scale,
          }}
        />
      ) : null}

      {handleTarget && !dragging
        ? RESIZE_HANDLES.map((handle) => {
            const position = HANDLE_POSITION[handle];
            const { rect } = handleTarget;
            return (
              <div
                key={handle}
                data-resize-handle={handle}
                data-resize-target={handleTarget.id}
                role="presentation"
                className="pointer-events-auto absolute size-2.5 rounded-[2px] border border-ink bg-amber"
                style={{
                  left: (rect.x + rect.width * position.x) * scale - 5,
                  top: (rect.y + rect.height * position.y) * scale - 5,
                  cursor: position.cursor,
                }}
              />
            );
          })
        : null}

      {marquee ? (
        <div
          className="absolute border border-amber/70 bg-amber/10"
          style={{
            left: marquee.x * scale,
            top: marquee.y * scale,
            width: marquee.width * scale,
            height: marquee.height * scale,
          }}
        />
      ) : null}
    </div>
  );
}
