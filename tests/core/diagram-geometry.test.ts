import { describe, expect, it } from "vitest";

import {
  anchorPoint,
  buildConnectorPath,
  chooseSides,
  labelPoint,
  pointAtProgress,
  resolveSides,
} from "@/core/diagram";

const left = { x: 100, y: 100, width: 200, height: 100 };
const right = { x: 600, y: 100, width: 200, height: 100 };
const below = { x: 100, y: 500, width: 200, height: 100 };

describe("anchorPoint", () => {
  it("sits on the middle of each side", () => {
    expect(anchorPoint(left, "top")).toEqual({ x: 200, y: 100 });
    expect(anchorPoint(left, "bottom")).toEqual({ x: 200, y: 200 });
    expect(anchorPoint(left, "left")).toEqual({ x: 100, y: 150 });
    expect(anchorPoint(left, "right")).toEqual({ x: 300, y: 150 });
  });
});

describe("chooseSides", () => {
  it("joins side by side nodes left to right", () => {
    expect(chooseSides(left, right)).toEqual({ source: "right", target: "left" });
    expect(chooseSides(right, left)).toEqual({ source: "left", target: "right" });
  });

  it("joins stacked nodes top to bottom", () => {
    expect(chooseSides(left, below)).toEqual({ source: "bottom", target: "top" });
    expect(chooseSides(below, left)).toEqual({ source: "top", target: "bottom" });
  });

  it("lets an explicit anchor override the automatic choice", () => {
    expect(resolveSides(left, right, "top", "auto")).toEqual({ source: "top", target: "left" });
    expect(resolveSides(left, right, "auto", "bottom")).toEqual({
      source: "right",
      target: "bottom",
    });
  });
});

describe("buildConnectorPath", () => {
  it("draws a straight route between the two anchors", () => {
    const path = buildConnectorPath(left, right, { kind: "straight" });

    expect(path.points[0]).toEqual({ x: 300, y: 150 });
    expect(path.points[path.points.length - 1]).toEqual({ x: 600, y: 150 });
    expect(path.length).toBeCloseTo(300);
    expect(path.d).toBe("M 300 150 L 600 150");
  });

  it("routes an orthogonal connector with a mid-way turn", () => {
    const path = buildConnectorPath(left, right, { kind: "orthogonal" });

    // Every segment runs on one axis only.
    for (let i = 1; i < path.points.length; i += 1) {
      const a = path.points[i - 1];
      const b = path.points[i];
      const straight = Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01;
      expect(straight).toBe(true);
    }

    expect(path.points[0]).toEqual({ x: 300, y: 150 });
    expect(path.points[path.points.length - 1]).toEqual({ x: 600, y: 150 });
  });

  it("turns exactly once when one end is horizontal and the other vertical", () => {
    const path = buildConnectorPath(left, below, {
      kind: "orthogonal",
      sourceAnchor: "right",
      targetAnchor: "top",
    });

    expect(path.points.length).toBeGreaterThanOrEqual(3);
    expect(path.points[0]).toEqual({ x: 300, y: 150 });
    expect(path.points[path.points.length - 1]).toEqual({ x: 200, y: 500 });
  });

  it("flattens a curve into samples that start and end on the anchors", () => {
    const path = buildConnectorPath(left, right, { kind: "curved" });

    expect(path.d.startsWith("M 300 150 C")).toBe(true);
    expect(path.points[0]).toEqual({ x: 300, y: 150 });
    expect(path.points[path.points.length - 1]).toEqual({ x: 600, y: 150 });
    // A curve is at least as long as the straight line it spans.
    expect(path.length).toBeGreaterThanOrEqual(300);
  });

  it("produces a measurable box even for a purely horizontal run", () => {
    const path = buildConnectorPath(left, right, { kind: "straight" });
    expect(path.bbox.width).toBeCloseTo(300);
    expect(path.bbox.height).toBeGreaterThan(0);
  });

  it("points the end angle along the direction of travel", () => {
    const path = buildConnectorPath(left, right, { kind: "straight" });
    expect(path.endAngle).toBeCloseTo(0);

    const downward = buildConnectorPath(left, below, { kind: "straight" });
    expect(downward.endAngle).toBeCloseTo(Math.PI / 2);
  });

  it("stays valid when both nodes sit on top of each other", () => {
    const path = buildConnectorPath(left, left, { kind: "straight" });
    expect(path.points.length).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(path.length)).toBe(true);
  });
});

describe("pointAtProgress", () => {
  const path = buildConnectorPath(left, right, { kind: "straight" });

  it("walks the route from start to end", () => {
    expect(pointAtProgress(path, 0)).toEqual({ x: 300, y: 150 });
    expect(pointAtProgress(path, 0.5).x).toBeCloseTo(450);
    expect(pointAtProgress(path, 1)).toEqual({ x: 600, y: 150 });
  });

  it("clamps outside 0 to 1", () => {
    expect(pointAtProgress(path, -2)).toEqual({ x: 300, y: 150 });
    expect(pointAtProgress(path, 5)).toEqual({ x: 600, y: 150 });
  });

  it("follows the corners of an orthogonal route", () => {
    const stepped = buildConnectorPath(left, below, {
      kind: "orthogonal",
      sourceAnchor: "bottom",
      targetAnchor: "top",
    });

    const middle = pointAtProgress(stepped, 0.5);
    // Halfway down a vertical route stays on the same column.
    expect(middle.y).toBeGreaterThan(200);
    expect(middle.y).toBeLessThan(500);
  });

  it("is deterministic for the same progress", () => {
    expect(pointAtProgress(path, 0.37)).toEqual(pointAtProgress(path, 0.37));
  });

  it("puts a label at the midpoint", () => {
    expect(labelPoint(path).x).toBeCloseTo(450);
  });
});
