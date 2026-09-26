"use client";

import { RESIZE_HANDLES, boundingRect, type ResizeHandle, type SnapGuide } from "@/core/editing";
import { NODE_SIDES, type NodeSide, type Rect } from "@/core/model";

/** Where each resize handle sits on the box, as a 0-1 fraction. */
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

const NUB_POSITION: Record<NodeSide, { x: number; y: number }> = {
  top: { x: 0.5, y: 0 },
  right: { x: 1, y: 0.5 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
};

/** How far outside the box a connect nub sits, in display pixels. */
const NUB_OFFSET = 15;

export interface SelectionBox {
  id: string;
  /** In canvas units. Derived from its endpoints for a connector. */
  rect: Rect;
  resizable: boolean;
  connectable: boolean;
}

export interface PendingConnection {
  /** Canvas units. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The node the pointer is currently over, if any. */
  targetRect: Rect | null;
}

/**
 * Selection chrome, drawn in display pixels on top of the scaled stage.
 *
 * Keeping it out of the scaled layer is what keeps handles, nubs and outlines
 * the same physical size at every zoom level.
 */
export function SelectionOverlay({
  boxes,
  scale,
  marquee,
  guides,
  pending,
  canvasWidth,
  canvasHeight,
  dragging,
}: {
  boxes: SelectionBox[];
  scale: number;
  marquee: Rect | null;
  guides: SnapGuide[];
  pending: PendingConnection | null;
  canvasWidth: number;
  canvasHeight: number;
  dragging: boolean;
}) {
  const bounds = boundingRect(boxes.map((box) => box.rect));
  const single = boxes.length === 1 ? boxes[0] : null;

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

      {boxes.map((box) => (
        <div
          key={box.id}
          className="absolute border border-amber"
          style={{
            left: box.rect.x * scale,
            top: box.rect.y * scale,
            width: box.rect.width * scale,
            height: box.rect.height * scale,
          }}
        />
      ))}

      {bounds && boxes.length > 1 ? (
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

      {single?.resizable && !dragging
        ? RESIZE_HANDLES.map((handle) => {
            const position = HANDLE_POSITION[handle];
            const { rect } = single;
            return (
              <div
                key={handle}
                data-resize-handle={handle}
                data-resize-target={single.id}
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

      {/* Connect nubs sit *outside* the box so they never compete with a resize
          handle for the same pixel. */}
      {single?.connectable && !dragging
        ? NODE_SIDES.map((side) => {
            const position = NUB_POSITION[side];
            const { rect } = single;
            const offsetX = side === "left" ? -NUB_OFFSET : side === "right" ? NUB_OFFSET : 0;
            const offsetY = side === "top" ? -NUB_OFFSET : side === "bottom" ? NUB_OFFSET : 0;

            return (
              <div
                key={side}
                data-connect-nub={side}
                data-connect-source={single.id}
                role="presentation"
                title={`Drag to connect from the ${side}`}
                className="pointer-events-auto absolute size-3 cursor-crosshair rounded-full border-2 border-ink bg-cyan"
                style={{
                  left: (rect.x + rect.width * position.x) * scale - 6 + offsetX,
                  top: (rect.y + rect.height * position.y) * scale - 6 + offsetY,
                }}
              />
            );
          })
        : null}

      {pending ? (
        <>
          <svg
            className="absolute inset-0 overflow-visible"
            width={canvasWidth * scale}
            height={canvasHeight * scale}
          >
            <line
              x1={pending.from.x * scale}
              y1={pending.from.y * scale}
              x2={pending.to.x * scale}
              y2={pending.to.y * scale}
              stroke="var(--color-cyan)"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          </svg>

          {pending.targetRect ? (
            <div
              className="absolute border-2 border-cyan bg-cyan/10"
              style={{
                left: pending.targetRect.x * scale,
                top: pending.targetRect.y * scale,
                width: pending.targetRect.width * scale,
                height: pending.targetRect.height * scale,
              }}
            />
          ) : null}
        </>
      ) : null}

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
