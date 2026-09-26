import { describe, expect, it } from "vitest";

import {
  compileDiagram,
  layeredLayout,
  measureNodeLabel,
  parseDiagramSource,
  pruneDanglingConnectors,
  rankNodes,
  toDiagramSource,
} from "@/core/diagram";
import { canvasConfigSchema, themeConfigSchema, type SceneElement } from "@/core/model";

const canvas = canvasConfigSchema.parse({});
const theme = themeConfigSchema.parse({});

function errorsOf(source: string) {
  return parseDiagramSource(source).issues.filter((issue) => issue.severity === "error");
}

describe("parseDiagramSource", () => {
  it("reads a direction header, nodes and edges", () => {
    const result = parseDiagramSource(`flowchart LR
      A[API Gateway] --> B{Authorized?}
      B -->|yes| C[(Database)]
      B -->|no| D[Reject]`);

    expect(result.ok).toBe(true);
    expect(result.diagram.direction).toBe("LR");
    expect(result.diagram.nodes.map((node) => node.key)).toEqual(["A", "B", "C", "D"]);
    expect(result.diagram.nodes[0].label).toBe("API Gateway");
    expect(result.diagram.nodes[1].shape).toBe("diamond");
    expect(result.diagram.nodes[2].shape).toBe("cylinder");
    expect(result.diagram.edges).toHaveLength(3);
    expect(result.diagram.edges[1].label).toBe("yes");
  });

  it("treats TD as a synonym for TB", () => {
    expect(parseDiagramSource("graph TD\n A --> B").diagram.direction).toBe("TB");
  });

  it("reads every supported shape", () => {
    const result = parseDiagramSource(`flowchart TB
      A[rect] --> B(round)
      B --> C([pill])
      C --> D[(store)]
      D --> E((circle))
      E --> F{decision}
      F --> G{{hex}}
      G --> H[[sub]]`);

    expect(result.diagram.nodes.map((node) => node.shape)).toEqual([
      "rectangle",
      "rounded",
      "pill",
      "cylinder",
      "circle",
      "diamond",
      "hexagon",
      "rectangle",
    ]);
  });

  it("reads every supported edge operator", () => {
    const result = parseDiagramSource(`flowchart LR
      A[a] --> B[b]
      B --- C[c]
      C -.-> D[d]
      D -.- E[e]
      E ==> F[f]
      F === G[g]
      G ----> H[h]`);

    expect(result.diagram.edges.map((edge) => [edge.style, edge.arrow])).toEqual([
      ["solid", true],
      ["solid", false],
      ["dashed", true],
      ["dashed", false],
      ["thick", true],
      ["thick", false],
      ["solid", true],
    ]);
  });

  it("expands a chain into one edge per hop", () => {
    const result = parseDiagramSource("flowchart LR\n A[a] --> B[b] --> C[c]");

    expect(result.diagram.nodes).toHaveLength(3);
    expect(result.diagram.edges).toEqual([
      { source: "A", target: "B", label: "", style: "solid", arrow: true },
      { source: "B", target: "C", label: "", style: "solid", arrow: true },
    ]);
  });

  it("ignores comments and trailing semicolons", () => {
    const result = parseDiagramSource(`flowchart LR
      %% this is a note
      A[a] --> B[b]; %% and this
`);

    expect(result.ok).toBe(true);
    expect(result.diagram.edges).toHaveLength(1);
  });

  it("lets a later mention add the label", () => {
    const result = parseDiagramSource("flowchart LR\n A --> B\n A[Gateway]");
    expect(result.diagram.nodes[0].label).toBe("Gateway");
  });

  it("falls back to the key when a node has no label", () => {
    expect(parseDiagramSource("flowchart LR\n A --> B").diagram.nodes[0].label).toBe("A");
  });

  it("strips quotes from labels", () => {
    const result = parseDiagramSource('flowchart LR\n A["Rate limit: 100/s"] --> B[b]');
    expect(result.diagram.nodes[0].label).toBe("Rate limit: 100/s");
  });

  it("reports an unterminated shape with its line number", () => {
    const errors = errorsOf("flowchart LR\n A[Gateway --> B");
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
    expect(errors[0].message).toContain('closing "]"');
  });

  it("reports an unterminated edge label", () => {
    const errors = errorsOf("flowchart LR\n A[a] -->|yes B[b]");
    expect(errors[0].message).toContain('closing "|"');
  });

  it("reports something that is not an arrow", () => {
    const errors = errorsOf("flowchart LR\n A[a] ~~> B[b]");
    expect(errors[0].message).toContain("Expected an arrow");
  });

  it("warns rather than fails on syntax it does not model", () => {
    const result = parseDiagramSource(`flowchart LR
      subgraph cluster
      A[a] --> B[b]
      end
      classDef big fill:#f00`);

    expect(result.ok).toBe(true);
    expect(result.diagram.edges).toHaveLength(1);
    expect(result.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(result.issues.map((issue) => issue.message).join(" ")).toContain("subgraph");
  });

  it("warns when no direction is given but still parses", () => {
    const result = parseDiagramSource("A[a] --> B[b]");
    expect(result.ok).toBe(true);
    expect(result.diagram.direction).toBe("TB");
    expect(result.issues[0].message).toContain("No direction");
  });

  it("is not ok for empty input", () => {
    expect(parseDiagramSource("").ok).toBe(false);
    expect(parseDiagramSource("flowchart LR").ok).toBe(false);
  });

  it("round trips through toDiagramSource", () => {
    const source = `flowchart LR
  A[Gateway]
  B{Authorized?}
  A -->|yes| B`;

    const first = parseDiagramSource(source);
    const second = parseDiagramSource(toDiagramSource(first.diagram));

    expect(second.diagram).toEqual(first.diagram);
  });
});

describe("rankNodes", () => {
  const nodes = ["A", "B", "C", "D"].map((id) => ({ id, width: 10, height: 10 }));

  it("ranks by longest path from a root", () => {
    const ranks = rankNodes(nodes, [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "A", target: "C" },
      { source: "C", target: "D" },
    ]);

    expect(ranks.get("A")).toBe(0);
    expect(ranks.get("B")).toBe(1);
    // Longest path wins, so C is after B rather than beside it.
    expect(ranks.get("C")).toBe(2);
    expect(ranks.get("D")).toBe(3);
  });

  it("terminates on a cycle instead of looping", () => {
    const ranks = rankNodes(nodes.slice(0, 3), [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
      { source: "C", target: "A" },
    ]);

    expect([...ranks.values()].every((rank) => Number.isFinite(rank))).toBe(true);
  });

  it("ignores a self edge", () => {
    const ranks = rankNodes(nodes.slice(0, 1), [{ source: "A", target: "A" }]);
    expect(ranks.get("A")).toBe(0);
  });
});

describe("layeredLayout", () => {
  const nodes = [
    { id: "A", width: 200, height: 100 },
    { id: "B", width: 200, height: 100 },
    { id: "C", width: 200, height: 100 },
  ];
  const edges = [
    { source: "A", target: "B" },
    { source: "A", target: "C" },
  ];

  it("stacks ranks downward for TB", () => {
    const placed = layeredLayout(nodes, edges, { direction: "TB", canvas });

    expect(placed.get("B")!.y).toBeGreaterThan(placed.get("A")!.y);
    // Siblings share a rank, so they sit on the same row.
    expect(placed.get("B")!.y).toBe(placed.get("C")!.y);
    expect(placed.get("B")!.x).not.toBe(placed.get("C")!.x);
  });

  it("runs ranks rightward for LR", () => {
    const placed = layeredLayout(nodes, edges, { direction: "LR", canvas });

    expect(placed.get("B")!.x).toBeGreaterThan(placed.get("A")!.x);
    expect(placed.get("B")!.x).toBe(placed.get("C")!.x);
  });

  it("reverses for BT and RL", () => {
    expect(layeredLayout(nodes, edges, { direction: "BT", canvas }).get("B")!.y).toBeLessThan(
      layeredLayout(nodes, edges, { direction: "BT", canvas }).get("A")!.y,
    );
    expect(layeredLayout(nodes, edges, { direction: "RL", canvas }).get("B")!.x).toBeLessThan(
      layeredLayout(nodes, edges, { direction: "RL", canvas }).get("A")!.x,
    );
  });

  it("keeps every node on the canvas", () => {
    const placed = layeredLayout(nodes, edges, { direction: "TB", canvas });

    for (const rect of placed.values()) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(canvas.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(canvas.height);
    }
  });

  it("produces integer coordinates and is deterministic", () => {
    const once = layeredLayout(nodes, edges, { direction: "TB", canvas });
    const twice = layeredLayout(nodes, edges, { direction: "TB", canvas });

    expect([...once.entries()]).toEqual([...twice.entries()]);
    for (const rect of once.values()) {
      expect(Number.isInteger(rect.x)).toBe(true);
      expect(Number.isInteger(rect.y)).toBe(true);
    }
  });

  it("returns nothing for no nodes", () => {
    expect(layeredLayout([], [], { direction: "TB", canvas }).size).toBe(0);
  });
});

describe("measureNodeLabel", () => {
  const options = { fontSize: 24, minWidth: 160, maxWidth: 500, padding: 20 };

  it("grows with the label and respects the bounds", () => {
    const short = measureNodeLabel("API", options);
    const long = measureNodeLabel("A considerably longer service name", options);

    expect(short.width).toBe(options.minWidth);
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.width).toBeLessThanOrEqual(options.maxWidth);
  });

  it("is taller when the text has to wrap", () => {
    const short = measureNodeLabel("API", options);
    const wrapped = measureNodeLabel(
      "An extremely long label that cannot possibly fit on one line",
      options,
    );
    expect(wrapped.height).toBeGreaterThan(short.height);
  });
});

describe("compileDiagram", () => {
  const source = `flowchart LR
    A[Gateway] --> B{Authorized?}
    B -->|yes| C[(Database)]`;

  function compile(existing: SceneElement[] = []) {
    const parsed = parseDiagramSource(source);
    return compileDiagram(parsed.diagram, { canvas, theme, existing });
  }

  it("builds one node per declared node and one connector per edge", () => {
    const { nodes, connectors } = compile();

    expect(nodes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
    expect(nodes.map((node) => node.content.label)).toEqual([
      "Gateway",
      "Authorized?",
      "Database",
    ]);
  });

  it("points connectors at real node ids", () => {
    const { nodes, connectors } = compile();
    const ids = new Set(nodes.map((node) => node.id));

    for (const connector of connectors) {
      expect(ids.has(connector.content.sourceId)).toBe(true);
      expect(ids.has(connector.content.targetId)).toBe(true);
    }
  });

  it("carries the edge label and style through", () => {
    const { connectors } = compile();
    expect(connectors[1].content.label).toBe("yes");
    expect(connectors[0].content.endArrow).toBe(true);
  });

  it("keeps a node's id, position and animations when the text is re-applied", () => {
    const first = compile();
    const moved = {
      ...first.nodes[0],
      rect: { ...first.nodes[0].rect, x: 42, y: 84 },
      animations: [
        {
          id: "an_1",
          type: "fade" as const,
          trigger: "enter" as const,
          offsetInFrames: 0,
          durationInFrames: 20,
          easing: "easeOut" as const,
          from: 0,
          to: 1,
        },
      ],
    };

    const second = compileDiagram(parseDiagramSource(source).diagram, {
      canvas,
      theme,
      existing: [moved, ...first.nodes.slice(1), ...first.connectors],
    });

    expect(second.nodes[0].id).toBe(first.nodes[0].id);
    expect(second.nodes[0].rect.x).toBe(42);
    expect(second.nodes[0].rect.y).toBe(84);
    expect(second.nodes[0].animations).toHaveLength(1);
  });

  it("re-measures a node whose label changed but keeps where it was put", () => {
    const first = compile();
    const moved = { ...first.nodes[0], rect: { ...first.nodes[0].rect, x: 42, y: 84 } };

    const second = compileDiagram(
      parseDiagramSource(source.replace("Gateway", "A much longer gateway name")).diagram,
      { canvas, theme, existing: [moved, ...first.nodes.slice(1), ...first.connectors] },
    );

    expect(second.nodes[0].rect.x).toBe(42);
    expect(second.nodes[0].rect.width).toBeGreaterThan(moved.rect.width);
  });

  it("drops a node that the text no longer mentions", () => {
    const first = compile();
    const second = compileDiagram(
      parseDiagramSource("flowchart LR\n A[Gateway] --> B{Authorized?}").diagram,
      { canvas, theme, existing: [...first.nodes, ...first.connectors] },
    );

    expect(second.nodes).toHaveLength(2);
    expect(second.connectors).toHaveLength(1);
  });

  it("makes a circle square", () => {
    const parsed = parseDiagramSource("flowchart LR\n A((Cache)) --> B[b]");
    const { nodes } = compileDiagram(parsed.diagram, { canvas, theme, existing: [] });

    expect(nodes[0].rect.width).toBe(nodes[0].rect.height);
  });
});

describe("pruneDanglingConnectors", () => {
  it("removes a connector whose node is gone", () => {
    const parsed = parseDiagramSource("flowchart LR\n A[a] --> B[b]");
    const { nodes, connectors } = compileDiagram(parsed.diagram, { canvas, theme, existing: [] });

    const withoutTarget = pruneDanglingConnectors([nodes[0], ...connectors]);
    expect(withoutTarget).toHaveLength(1);
    expect(withoutTarget[0].type).toBe("node");
  });

  it("keeps a connector whose endpoints are both present", () => {
    const parsed = parseDiagramSource("flowchart LR\n A[a] --> B[b]");
    const { nodes, connectors } = compileDiagram(parsed.diagram, { canvas, theme, existing: [] });

    expect(pruneDanglingConnectors([...nodes, ...connectors])).toHaveLength(3);
  });
});
