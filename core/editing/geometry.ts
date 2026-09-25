import type { CanvasConfig } from "@/core/model/canvas";
import type { Rect } from "@/core/model/primitives";

export const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** Nothing may be resized smaller than this, in canvas units. */
export const MIN_ELEMENT_SIZE = 8;

export function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function translateRect(rect: Rect, dx: number, dy: number): Rect {
  return { ...rect, x: rect.x + dx, y: rect.y + dy };
}

/**
 * Applies a drag on one resize handle.
 *
 * The opposite edge stays put, which is what makes a resize feel anchored.
 * Dragging a handle past its opposite edge clamps at the minimum size rather
 * than flipping the element inside out.
 */
export function resizeRect(
  rect: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: { preserveAspectRatio?: boolean } = {},
): Rect {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  let { x, y } = rect;
  let width = rect.width;
  let height = rect.height;

  if (handle.includes("w")) {
    x = Math.min(rect.x + dx, right - MIN_ELEMENT_SIZE);
    width = right - x;
  } else if (handle.includes("e")) {
    width = Math.max(MIN_ELEMENT_SIZE, rect.width + dx);
  }

  if (handle.includes("n")) {
    y = Math.min(rect.y + dy, bottom - MIN_ELEMENT_SIZE);
    height = bottom - y;
  } else if (handle.includes("s")) {
    height = Math.max(MIN_ELEMENT_SIZE, rect.height + dy);
  }

  if (options.preserveAspectRatio && rect.width > 0 && rect.height > 0) {
    const ratio = rect.width / rect.height;
    const isCorner = handle.length === 2;

    if (isCorner) {
      // Let the larger change win so the drag tracks the pointer.
      if (Math.abs(width - rect.width) >= Math.abs(height - rect.height)) {
        height = Math.max(MIN_ELEMENT_SIZE, width / ratio);
      } else {
        width = Math.max(MIN_ELEMENT_SIZE, height * ratio);
      }
    } else if (handle === "e" || handle === "w") {
      height = Math.max(MIN_ELEMENT_SIZE, width / ratio);
    } else {
      width = Math.max(MIN_ELEMENT_SIZE, height * ratio);
    }

    // Re-anchor the edges the handle is not dragging.
    if (handle.includes("w")) x = right - width;
    if (handle.includes("n")) y = bottom - height;
  }

  return { x, y, width, height };
}

export interface SnapGuide {
  axis: "x" | "y";
  position: number;
  /** Why the guide appeared, for the label shown next to it. */
  source: "canvas" | "element";
}

export interface SnapResult {
  rect: Rect;
  guides: SnapGuide[];
}

interface SnapLine {
  position: number;
  source: SnapGuide["source"];
}

function linesFor(rects: Rect[], axis: "x" | "y"): SnapLine[] {
  return rects.flatMap((rect) => {
    const start = axis === "x" ? rect.x : rect.y;
    const size = axis === "x" ? rect.width : rect.height;
    return [
      { position: start, source: "element" as const },
      { position: start + size / 2, source: "element" as const },
      { position: start + size, source: "element" as const },
    ];
  });
}

function bestSnap(
  edges: number[],
  lines: SnapLine[],
  threshold: number,
): { delta: number; line: SnapLine } | null {
  let best: { delta: number; line: SnapLine } | null = null;

  for (const edge of edges) {
    for (const line of lines) {
      const delta = line.position - edge;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, line };
    }
  }

  return best;
}

/**
 * Nudges a rect onto the nearest alignment line on each axis.
 *
 * Candidates are the canvas edges and centre plus every other element's edges
 * and centre. Only the closest line within the threshold wins per axis, so an
 * element never jumps between two competing guides.
 */
export function snapRect(
  rect: Rect,
  others: Rect[],
  canvas: CanvasConfig,
  threshold = 8,
): SnapResult {
  const xLines: SnapLine[] = [
    { position: 0, source: "canvas" },
    { position: canvas.width / 2, source: "canvas" },
    { position: canvas.width, source: "canvas" },
    ...linesFor(others, "x"),
  ];
  const yLines: SnapLine[] = [
    { position: 0, source: "canvas" },
    { position: canvas.height / 2, source: "canvas" },
    { position: canvas.height, source: "canvas" },
    ...linesFor(others, "y"),
  ];

  const snapX = bestSnap([rect.x, rect.x + rect.width / 2, rect.x + rect.width], xLines, threshold);
  const snapY = bestSnap(
    [rect.y, rect.y + rect.height / 2, rect.y + rect.height],
    yLines,
    threshold,
  );

  const guides: SnapGuide[] = [];
  if (snapX) guides.push({ axis: "x", position: snapX.line.position, source: snapX.line.source });
  if (snapY) guides.push({ axis: "y", position: snapY.line.position, source: snapY.line.source });

  return {
    rect: {
      x: rect.x + (snapX?.delta ?? 0),
      y: rect.y + (snapY?.delta ?? 0),
      width: rect.width,
      height: rect.height,
    },
    guides,
  };
}

export const ALIGNMENTS = [
  "left",
  "centerX",
  "right",
  "top",
  "centerY",
  "bottom",
] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

/**
 * Aligns rects to each other's bounding box. With a single rect there is
 * nothing to align against, so it aligns to the canvas instead.
 */
export function alignRects(rects: Rect[], alignment: Alignment, canvas: CanvasConfig): Rect[] {
  if (rects.length === 0) return rects;

  const bounds =
    rects.length === 1
      ? { left: 0, top: 0, right: canvas.width, bottom: canvas.height }
      : {
          left: Math.min(...rects.map((rect) => rect.x)),
          top: Math.min(...rects.map((rect) => rect.y)),
          right: Math.max(...rects.map((rect) => rect.x + rect.width)),
          bottom: Math.max(...rects.map((rect) => rect.y + rect.height)),
        };

  return rects.map((rect) => {
    switch (alignment) {
      case "left":
        return { ...rect, x: bounds.left };
      case "right":
        return { ...rect, x: bounds.right - rect.width };
      case "centerX":
        return { ...rect, x: (bounds.left + bounds.right) / 2 - rect.width / 2 };
      case "top":
        return { ...rect, y: bounds.top };
      case "bottom":
        return { ...rect, y: bounds.bottom - rect.height };
      case "centerY":
        return { ...rect, y: (bounds.top + bounds.bottom) / 2 - rect.height / 2 };
    }
  });
}

/** Do two rects overlap at all? Used by marquee selection. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

/** Normalises a drag between two points into a positive-sized rect. */
export function rectFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Rect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.max(1, Math.abs(bx - ax)),
    height: Math.max(1, Math.abs(by - ay)),
  };
}

/** The smallest rect containing all of the given rects. */
export function boundingRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}
