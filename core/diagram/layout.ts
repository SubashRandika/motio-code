import type { CanvasConfig } from "@/core/model/canvas";
import type { Rect } from "@/core/model/primitives";

export const LAYOUT_DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutOptions {
  direction: LayoutDirection;
  canvas: CanvasConfig;
  /** Space between ranks, along the flow direction. */
  rankGap?: number;
  /** Space between nodes inside one rank. */
  nodeGap?: number;
}

/**
 * Ranks each node by its longest path from a root.
 *
 * Relaxation rather than a topological sort, so a cycle degrades into a
 * reasonable ranking instead of failing: each pass can only raise a rank, and
 * ranks are bounded by the node count, so it always terminates.
 */
export function rankNodes(nodes: LayoutNode[], edges: LayoutEdge[]): Map<string, number> {
  const ranks = new Map<string, number>(nodes.map((node) => [node.id, 0]));

  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;

    for (const edge of edges) {
      if (edge.source === edge.target) continue;
      if (!ranks.has(edge.source) || !ranks.has(edge.target)) continue;

      const candidate = (ranks.get(edge.source) ?? 0) + 1;
      if (candidate > (ranks.get(edge.target) ?? 0)) {
        ranks.set(edge.target, candidate);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return ranks;
}

/**
 * Places nodes in ranks along the flow direction, centred on the canvas.
 *
 * This is the minimum needed to draw a graph that was written as text rather
 * than arranged by hand. It is deliberately not a general graph-layout engine:
 * edge-crossing minimisation and the rest belong to a later phase.
 */
export function layeredLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions,
): Map<string, Rect> {
  const placed = new Map<string, Rect>();
  if (nodes.length === 0) return placed;

  const { canvas, direction } = options;
  const rankGap = options.rankGap ?? Math.round(canvas.height * 0.09);
  const nodeGap = options.nodeGap ?? Math.round(canvas.width * 0.03);

  const ranks = rankNodes(nodes, edges);
  const maxRank = Math.max(...nodes.map((node) => ranks.get(node.id) ?? 0));

  // Group by rank, keeping the order the nodes were declared in.
  const grouped: LayoutNode[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const node of nodes) {
    grouped[ranks.get(node.id) ?? 0].push(node);
  }

  const vertical = direction === "TB" || direction === "BT";
  const reversed = direction === "BT" || direction === "RL";
  const ordered = reversed ? [...grouped].reverse() : grouped;

  const mainOf = (node: LayoutNode) => (vertical ? node.height : node.width);
  const crossOf = (node: LayoutNode) => (vertical ? node.width : node.height);

  let mainCursor = 0;
  const positions: { node: LayoutNode; main: number; cross: number }[] = [];

  for (const rank of ordered) {
    if (rank.length === 0) continue;

    const rankMain = Math.max(...rank.map(mainOf));
    const crossExtent =
      rank.reduce((total, node) => total + crossOf(node), 0) + nodeGap * (rank.length - 1);

    let crossCursor = -crossExtent / 2;
    for (const node of rank) {
      positions.push({
        node,
        // Centre each node within its rank's thickness.
        main: mainCursor + (rankMain - mainOf(node)) / 2,
        cross: crossCursor,
      });
      crossCursor += crossOf(node) + nodeGap;
    }

    mainCursor += rankMain + rankGap;
  }

  const mainExtent = Math.max(0, mainCursor - rankGap);
  const crossMin = Math.min(...positions.map((entry) => entry.cross));
  const crossMax = Math.max(...positions.map((entry) => entry.cross + crossOf(entry.node)));

  // Centre the whole graph on the canvas.
  const mainOrigin = ((vertical ? canvas.height : canvas.width) - mainExtent) / 2;
  const crossOrigin =
    ((vertical ? canvas.width : canvas.height) - (crossMax - crossMin)) / 2 - crossMin;

  for (const entry of positions) {
    const main = Math.round(mainOrigin + entry.main);
    const cross = Math.round(crossOrigin + entry.cross);

    placed.set(entry.node.id, {
      x: vertical ? cross : main,
      y: vertical ? main : cross,
      width: entry.node.width,
      height: entry.node.height,
    });
  }

  return placed;
}

/**
 * Approximates the box a label needs.
 *
 * Deliberately arithmetic rather than measured: layout must produce the same
 * result on a server, in a test and in a browser, and a DOM measurement would
 * not.
 */
export function measureNodeLabel(
  label: string,
  options: { fontSize: number; minWidth: number; maxWidth: number; padding: number },
): { width: number; height: number } {
  const lines = label.split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));

  // 0.58em is a good average advance width for a humanist sans at these sizes.
  const textWidth = longest * options.fontSize * 0.58;
  const width = Math.round(
    Math.min(options.maxWidth, Math.max(options.minWidth, textWidth + options.padding * 2)),
  );

  const wrappedLines = Math.max(
    lines.length,
    Math.ceil(textWidth / Math.max(1, width - options.padding * 2)),
  );
  const height = Math.round(
    Math.max(options.fontSize * 2.6, wrappedLines * options.fontSize * 1.35 + options.padding * 2),
  );

  return { width, height };
}
