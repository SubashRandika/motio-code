import { describe, expect, it } from "vitest";

import {
  MIN_ELEMENT_SIZE,
  alignRects,
  boundingRect,
  rectFromPoints,
  rectsIntersect,
  resizeRect,
  snapRect,
} from "@/core/editing";
import { canvasConfigSchema } from "@/core/model";

const canvas = canvasConfigSchema.parse({}); // 1920 x 1080
const rect = { x: 100, y: 100, width: 200, height: 100 };

describe("resizeRect", () => {
  it("grows from the east handle without moving the west edge", () => {
    expect(resizeRect(rect, "e", 50, 0)).toEqual({ x: 100, y: 100, width: 250, height: 100 });
  });

  it("moves the west edge and keeps the east edge anchored", () => {
    expect(resizeRect(rect, "w", 50, 0)).toEqual({ x: 150, y: 100, width: 150, height: 100 });
  });

  it("resizes both axes from a corner", () => {
    expect(resizeRect(rect, "se", 40, 30)).toEqual({ x: 100, y: 100, width: 240, height: 130 });
  });

  it("clamps at the minimum size instead of inverting", () => {
    const squashed = resizeRect(rect, "e", -1000, 0);
    expect(squashed.width).toBe(MIN_ELEMENT_SIZE);

    const fromWest = resizeRect(rect, "w", 1000, 0);
    expect(fromWest.width).toBe(MIN_ELEMENT_SIZE);
    expect(fromWest.x).toBe(300 - MIN_ELEMENT_SIZE);
  });

  it("keeps the aspect ratio when asked", () => {
    const resized = resizeRect(rect, "se", 100, 0, { preserveAspectRatio: true });
    expect(resized.width / resized.height).toBeCloseTo(rect.width / rect.height);
  });

  it("re-anchors the far edge when preserving aspect from a north-west corner", () => {
    const resized = resizeRect(rect, "nw", -50, 0, { preserveAspectRatio: true });
    expect(resized.x + resized.width).toBeCloseTo(300);
    expect(resized.y + resized.height).toBeCloseTo(200);
  });
});

describe("snapRect", () => {
  it("snaps a near-centred rect onto the canvas centre", () => {
    const moving = { x: 856, y: 400, width: 200, height: 100 };
    const result = snapRect(moving, [], canvas, 8);

    // Canvas centre is 960, so a centred rect starts at 860.
    expect(result.rect.x).toBe(860);
    expect(result.guides).toContainEqual({ axis: "x", position: 960, source: "canvas" });
  });

  it("snaps to another element's edge", () => {
    const other = { x: 500, y: 0, width: 100, height: 50 };
    const moving = { x: 503, y: 800, width: 100, height: 50 };

    const result = snapRect(moving, [other], canvas, 8);
    expect(result.rect.x).toBe(500);
    expect(result.guides).toContainEqual({ axis: "x", position: 500, source: "element" });
  });

  it("leaves a rect alone when nothing is within the threshold", () => {
    const moving = { x: 137, y: 411, width: 90, height: 40 };
    const result = snapRect(moving, [], canvas, 8);

    expect(result.rect).toEqual(moving);
    expect(result.guides).toEqual([]);
  });

  it("picks the closest of two competing lines", () => {
    // Left edges at 280 and 296; the moving rect's left edge sits at 300, so
    // 296 is 4 away and the other candidates are further.
    const others = [
      { x: 280, y: 0, width: 100, height: 10 },
      { x: 296, y: 0, width: 100, height: 10 },
    ];
    const result = snapRect({ x: 300, y: 500, width: 40, height: 50 }, others, canvas, 8);
    expect(result.rect.x).toBe(296);
  });

  it("snaps each axis independently", () => {
    // Left edge 3 -> 0, and bottom edge 1076 -> the 1080 canvas floor.
    const result = snapRect({ x: 3, y: 1026, width: 50, height: 50 }, [], canvas, 8);
    expect(result.rect.x).toBe(0);
    expect(result.rect.y).toBe(1030);
    expect(result.rect.y + result.rect.height).toBe(canvas.height);
  });
});

describe("alignRects", () => {
  const a = { x: 0, y: 0, width: 100, height: 50 };
  const b = { x: 200, y: 300, width: 50, height: 50 };

  it("aligns a group to its own bounding box", () => {
    expect(alignRects([a, b], "left", canvas).map((r) => r.x)).toEqual([0, 0]);
    expect(alignRects([a, b], "right", canvas).map((r) => r.x + r.width)).toEqual([250, 250]);
    expect(alignRects([a, b], "top", canvas).map((r) => r.y)).toEqual([0, 0]);
  });

  it("centres a group on the midpoint of its bounds", () => {
    const [first, second] = alignRects([a, b], "centerX", canvas);
    expect(first.x + first.width / 2).toBeCloseTo(125);
    expect(second.x + second.width / 2).toBeCloseTo(125);
  });

  it("aligns a lone rect to the canvas instead", () => {
    const [only] = alignRects([a], "centerX", canvas);
    expect(only.x + only.width / 2).toBeCloseTo(canvas.width / 2);
  });

  it("returns an empty list unchanged", () => {
    expect(alignRects([], "left", canvas)).toEqual([]);
  });
});

describe("rect helpers", () => {
  it("detects overlap", () => {
    expect(rectsIntersect(rect, { x: 250, y: 150, width: 100, height: 100 })).toBe(true);
    expect(rectsIntersect(rect, { x: 400, y: 400, width: 10, height: 10 })).toBe(false);
  });

  it("treats touching edges as not overlapping", () => {
    expect(rectsIntersect(rect, { x: 300, y: 100, width: 50, height: 50 })).toBe(false);
  });

  it("normalises a drag made in any direction", () => {
    expect(rectFromPoints(300, 300, 100, 100)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 200,
    });
  });

  it("wraps a group of rects", () => {
    expect(boundingRect([rect, { x: 400, y: 50, width: 100, height: 100 }])).toEqual({
      x: 100,
      y: 50,
      width: 400,
      height: 150,
    });
    expect(boundingRect([])).toBeNull();
  });
});
