import type { CanvasConfig } from "@/core/model/canvas";
import {
  elementStyleSchema,
  isConnector,
  isNode,
  type ConnectorElement,
  type NodeElement,
  type SceneElement,
} from "@/core/model/element";
import { createId } from "@/core/model/primitives";
import type { ThemeConfig } from "@/core/model/theme";

import { layeredLayout, measureNodeLabel, type LayoutNode } from "./layout";
import type { ParsedDiagram } from "./mermaid";

export interface CompiledDiagram {
  /** Painted first, so routes sit behind the boxes they join. */
  connectors: ConnectorElement[];
  nodes: NodeElement[];
}

export interface CompileOptions {
  canvas: CanvasConfig;
  theme: ThemeConfig;
  /**
   * The scene's current elements. Nodes whose `sourceKey` still appears in the
   * text keep their id, position and animations, so re-applying edited text
   * does not scramble a layout the user arranged by hand.
   */
  existing: SceneElement[];
}

function nodeFontSize(canvas: CanvasConfig): number {
  return Math.max(12, Math.round(canvas.height * 0.024));
}

/**
 * Turns a parsed graph into scene elements.
 *
 * The rule this encodes: **text owns structure, the canvas owns position.**
 * Applying text adds, removes and relabels nodes and edges; it only places a
 * node the first time that node appears.
 */
export function compileDiagram(
  parsed: ParsedDiagram,
  { canvas, theme, existing }: CompileOptions,
): CompiledDiagram {
  const fontSize = nodeFontSize(canvas);
  const baseStyle = elementStyleSchema.parse({});

  const existingNodes = existing.filter(isNode);
  const existingConnectors = existing.filter(isConnector);
  const bySourceKey = new Map(
    existingNodes
      .filter((node) => node.content.sourceKey !== null)
      .map((node) => [node.content.sourceKey as string, node]),
  );

  // Measure every label so layout knows how much room each box needs.
  const layoutNodes: LayoutNode[] = parsed.nodes.map((node) => {
    const measured = measureNodeLabel(node.label, {
      fontSize,
      minWidth: Math.round(canvas.width * 0.1),
      maxWidth: Math.round(canvas.width * 0.3),
      padding: Math.round(fontSize * 0.9),
    });

    // A circle needs to be square to look like one.
    const size =
      node.shape === "circle"
        ? { width: Math.max(measured.width, measured.height), height: Math.max(measured.width, measured.height) }
        : measured;

    return { id: node.key, ...size };
  });

  const { rects: placed, scale } = layeredLayout(
    layoutNodes,
    parsed.edges.map((edge) => ({ source: edge.source, target: edge.target })),
    { direction: parsed.direction, canvas },
  );

  // A graph that had to be shrunk to fit gets labels shrunk by the same factor,
  // so the text stays in proportion to the box around it.
  const scaledFontSize = Math.max(10, Math.round(fontSize * scale));

  const nodes: NodeElement[] = parsed.nodes.map((parsedNode, index) => {
    const laidOut = placed.get(parsedNode.key) ?? {
      x: Math.round(canvas.width * 0.1),
      y: Math.round(canvas.height * 0.1),
      width: Math.round(canvas.width * 0.16),
      height: Math.round(canvas.height * 0.1),
    };

    const reused = bySourceKey.get(parsedNode.key);

    if (reused) {
      const labelChanged = reused.content.label !== parsedNode.label;
      return {
        ...reused,
        // Keep where the user put it; only re-measure when the label changed.
        rect: labelChanged
          ? { ...reused.rect, width: laidOut.width, height: laidOut.height }
          : reused.rect,
        name: parsedNode.label || parsedNode.key,
        content: {
          ...reused.content,
          label: parsedNode.label,
          shape: parsedNode.shape,
          sourceKey: parsedNode.key,
        },
      };
    }

    return {
      id: createId("nd"),
      name: parsedNode.label || parsedNode.key,
      type: "node",
      rect: laidOut,
      layer: index,
      from: 0,
      durationInFrames: null,
      locked: false,
      hidden: false,
      style: {
        ...baseStyle,
        fill: theme.surface,
        stroke: theme.border,
        strokeWidth: 2,
        cornerRadius: 10,
      },
      animations: [],
      content: {
        label: parsedNode.label,
        sublabel: "",
        shape: parsedNode.shape,
        icon: "none",
        accent: null,
        fontSize: scaledFontSize,
        align: "center",
        sourceKey: parsedNode.key,
      },
    };
  });

  const idForKey = new Map(nodes.map((node) => [node.content.sourceKey as string, node.id]));

  // Match an existing connector by the pair of source keys it joins.
  const connectorByPair = new Map<string, ConnectorElement>();
  for (const connector of existingConnectors) {
    const source = existingNodes.find((node) => node.id === connector.content.sourceId);
    const target = existingNodes.find((node) => node.id === connector.content.targetId);
    if (source?.content.sourceKey && target?.content.sourceKey) {
      connectorByPair.set(`${source.content.sourceKey}->${target.content.sourceKey}`, connector);
    }
  }

  const connectors: ConnectorElement[] = parsed.edges.flatMap((edge, index) => {
    const sourceId = idForKey.get(edge.source);
    const targetId = idForKey.get(edge.target);
    // A dangling edge is dropped rather than creating a connector to nowhere.
    if (!sourceId || !targetId) return [];

    const reused = connectorByPair.get(`${edge.source}->${edge.target}`);

    if (reused) {
      return [
        {
          ...reused,
          content: {
            ...reused.content,
            sourceId,
            targetId,
            label: edge.label,
            dashed: edge.style === "dashed",
            endArrow: edge.arrow,
            thickness: edge.style === "thick" ? 5 : reused.content.thickness,
          },
        },
      ];
    }

    return [
      {
        id: createId("cn"),
        name: edge.label || `${edge.source} to ${edge.target}`,
        type: "connector",
        rect: { x: 0, y: 0, width: 1, height: 1 },
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: {
          ...baseStyle,
          stroke: theme.muted,
          strokeWidth: edge.style === "thick" ? 5 : 2,
        },
        animations: [],
        content: {
          sourceId,
          targetId,
          sourceAnchor: "auto",
          targetAnchor: "auto",
          kind: parsed.direction === "LR" || parsed.direction === "RL" ? "orthogonal" : "orthogonal",
          label: edge.label,
          startArrow: false,
          endArrow: edge.arrow,
          dashed: edge.style === "dashed",
          thickness: edge.style === "thick" ? 5 : 2,
        },
      },
    ];
  });

  return { connectors, nodes };
}

/**
 * Drops connectors whose endpoints are gone.
 *
 * Applied when deleting and again when loading, so a scene saved by an older
 * build (or hand-edited through the configuration panel) can never render a
 * route to nowhere.
 */
export function pruneDanglingConnectors(elements: SceneElement[]): SceneElement[] {
  const nodeIds = new Set(elements.filter(isNode).map((node) => node.id));

  return elements.filter(
    (element) =>
      !isConnector(element) ||
      (nodeIds.has(element.content.sourceId) && nodeIds.has(element.content.targetId)),
  );
}

/** Connectors attached to any of the given nodes. */
export function connectorsFor(elements: SceneElement[], nodeIds: string[]): ConnectorElement[] {
  const ids = new Set(nodeIds);
  return elements
    .filter(isConnector)
    .filter(
      (connector) => ids.has(connector.content.sourceId) || ids.has(connector.content.targetId),
    );
}
