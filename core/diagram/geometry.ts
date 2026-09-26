// The schemas own these vocabularies; the router just consumes them.
import type { ConnectorAnchor, ConnectorKind, NodeSide } from "@/core/model/element";
import type { Rect } from "@/core/model/primitives";

export interface Point {
  x: number;
  y: number;
}

/** How far an orthogonal route travels straight out of a node before turning. */
const STUB = 18;

/** Samples used to flatten a curve into a polyline. */
const CURVE_SAMPLES = 48;

export function anchorPoint(rect: Rect, side: NodeSide): Point {
  switch (side) {
    case "top":
      return { x: rect.x + rect.width / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case "left":
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case "right":
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  }
}

function isHorizontal(side: NodeSide): boolean {
  return side === "left" || side === "right";
}

function outwardOffset(point: Point, side: NodeSide, distance: number): Point {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - distance };
    case "bottom":
      return { x: point.x, y: point.y + distance };
    case "left":
      return { x: point.x - distance, y: point.y };
    case "right":
      return { x: point.x + distance, y: point.y };
  }
}

/**
 * Picks the pair of sides that gives the shortest, least crossing route.
 *
 * Whichever axis the two nodes are further apart on wins, so nodes side by side
 * connect left-to-right and stacked nodes connect top-to-bottom.
 */
export function chooseSides(source: Rect, target: Rect): { source: NodeSide; target: NodeSide } {
  const sourceCentre = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCentre = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const dx = targetCentre.x - sourceCentre.x;
  const dy = targetCentre.y - sourceCentre.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }
  return dy >= 0 ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
}

export function resolveSides(
  source: Rect,
  target: Rect,
  sourceAnchor: ConnectorAnchor,
  targetAnchor: ConnectorAnchor,
): { source: NodeSide; target: NodeSide } {
  const auto = chooseSides(source, target);
  return {
    source: sourceAnchor === "auto" ? auto.source : sourceAnchor,
    target: targetAnchor === "auto" ? auto.target : targetAnchor,
  };
}

export interface ConnectorPath {
  /** SVG path data in canvas units. */
  d: string;
  /** Flattened polyline, used for length, sampling and the bounding box. */
  points: Point[];
  length: number;
  bbox: Rect;
  /** Radians, pointing along the route, for arrowheads. */
  startAngle: number;
  endAngle: number;
}

function dedupe(points: Point[]): Point[] {
  return points.filter(
    (point, index) =>
      index === 0 ||
      Math.abs(point.x - points[index - 1].x) > 0.01 ||
      Math.abs(point.y - points[index - 1].y) > 0.01,
  );
}

function orthogonalPoints(
  start: Point,
  startSide: NodeSide,
  end: Point,
  endSide: NodeSide,
): Point[] {
  const a = outwardOffset(start, startSide, STUB);
  const b = outwardOffset(end, endSide, STUB);

  if (isHorizontal(startSide) && isHorizontal(endSide)) {
    const midX = (a.x + b.x) / 2;
    return dedupe([start, a, { x: midX, y: a.y }, { x: midX, y: b.y }, b, end]);
  }

  if (!isHorizontal(startSide) && !isHorizontal(endSide)) {
    const midY = (a.y + b.y) / 2;
    return dedupe([start, a, { x: a.x, y: midY }, { x: b.x, y: midY }, b, end]);
  }

  // One horizontal, one vertical: a single corner joins the two stubs.
  const corner = isHorizontal(startSide) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  return dedupe([start, a, corner, b, end]);
}

function cubicAt(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;

  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function bboxOf(points: Point[]): Rect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);

  return {
    x: left,
    y: top,
    // A straight horizontal or vertical run has no extent on one axis; keep the
    // rect valid so it can still be measured and outlined.
    width: Math.max(1, Math.max(...xs) - left),
    height: Math.max(1, Math.max(...ys) - top),
  };
}

function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Builds the route between two node boxes.
 *
 * Every kind is flattened to a polyline as well as an SVG path: the polyline is
 * what lets a flow marker be positioned at a given progress with pure maths,
 * instead of asking the DOM for `getPointAtLength` -- which would not work in a
 * headless render and would not be frame-deterministic.
 */
export function buildConnectorPath(
  source: Rect,
  target: Rect,
  options: {
    kind: ConnectorKind;
    sourceAnchor?: ConnectorAnchor;
    targetAnchor?: ConnectorAnchor;
  },
): ConnectorPath {
  const sides = resolveSides(
    source,
    target,
    options.sourceAnchor ?? "auto",
    options.targetAnchor ?? "auto",
  );

  const start = anchorPoint(source, sides.source);
  const end = anchorPoint(target, sides.target);

  if (options.kind === "curved") {
    const distance = Math.max(48, Math.hypot(end.x - start.x, end.y - start.y) * 0.4);
    const control1 = outwardOffset(start, sides.source, distance);
    const control2 = outwardOffset(end, sides.target, distance);

    const points: Point[] = [];
    for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
      points.push(cubicAt(i / CURVE_SAMPLES, start, control1, control2, end));
    }

    return {
      d: `M ${round(start.x)} ${round(start.y)} C ${round(control1.x)} ${round(control1.y)}, ${round(control2.x)} ${round(control2.y)}, ${round(end.x)} ${round(end.y)}`,
      points,
      length: polylineLength(points),
      bbox: bboxOf(points),
      startAngle: angleBetween(points[0], points[1]),
      endAngle: angleBetween(points[points.length - 2], points[points.length - 1]),
    };
  }

  const points =
    options.kind === "orthogonal"
      ? orthogonalPoints(start, sides.source, end, sides.target)
      : dedupe([start, end]);

  // A source and target that resolve to the same point would leave one point.
  const safePoints = points.length >= 2 ? points : [start, { x: start.x + 1, y: start.y }];

  return {
    d: safePoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`)
      .join(" "),
    points: safePoints,
    length: polylineLength(safePoints),
    bbox: bboxOf(safePoints),
    startAngle: angleBetween(safePoints[0], safePoints[1]),
    endAngle: angleBetween(safePoints[safePoints.length - 2], safePoints[safePoints.length - 1]),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The point a given fraction of the way along the route. */
export function pointAtProgress(path: ConnectorPath, progress: number): Point {
  const points = path.points;
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const clamped = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  const target = path.length * clamped;

  let travelled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (travelled + segment >= target || i === points.length - 1) {
      const within = segment === 0 ? 0 : (target - travelled) / segment;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * within,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * within,
      };
    }
    travelled += segment;
  }

  return points[points.length - 1];
}

/**
 * Direction of travel at a point along the route, for an arrowhead that leads a
 * draw-on reveal. Sampled either side of the point so a corner reads sensibly.
 */
export function angleAtProgress(path: ConnectorPath, progress: number): number {
  if (path.length === 0) return path.endAngle;

  const step = Math.min(0.02, 4 / path.length);
  const behind = pointAtProgress(path, Math.max(0, progress - step));
  const ahead = pointAtProgress(path, Math.min(1, progress + step));

  if (Math.abs(ahead.x - behind.x) < 0.001 && Math.abs(ahead.y - behind.y) < 0.001) {
    return path.endAngle;
  }
  return Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
}

/** Midpoint of the route, where a connector's label sits. */
export function labelPoint(path: ConnectorPath): Point {
  return pointAtProgress(path, 0.5);
}
