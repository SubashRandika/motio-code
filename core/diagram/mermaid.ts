import type { DiagramNodeShape } from "@/core/model/element";

import type { LayoutDirection } from "./layout";

/**
 * A parser for the Mermaid flowchart subset, not the Mermaid library.
 *
 * MotioCode needs the *graph*, not a picture of it: the nodes and edges become
 * ordinary scene elements that the animation engine and the renderer already
 * understand. Mermaid renders its own SVG through the DOM, which cannot drive a
 * frame-deterministic composition and could not be animated per node. Borrowing
 * the syntax gives users a format they already know at no bundle cost.
 *
 * Supported:
 *   flowchart LR | graph TD          direction header (TB, TD, BT, LR, RL)
 *   A[Label]                         rectangle
 *   A(Label)                         rounded
 *   A([Label])                       pill
 *   A[[Label]]                       rectangle (subroutine)
 *   A[(Label)]                       cylinder, for stores
 *   A((Label))                       circle
 *   A{Label}                         diamond, for decisions
 *   A{{Label}}                       hexagon
 *   A --> B        A --- B           solid arrow / line
 *   A -.-> B       A -.- B           dashed
 *   A ==> B        A === B           thick
 *   A -->|yes| B                     edge label
 *   A --> B --> C                    chains
 *   %% comment
 */

export type EdgeStyle = "solid" | "dashed" | "thick";

export interface ParsedNode {
  key: string;
  label: string;
  shape: DiagramNodeShape;
}

export interface ParsedEdge {
  source: string;
  target: string;
  label: string;
  style: EdgeStyle;
  arrow: boolean;
}

export interface ParsedDiagram {
  direction: LayoutDirection;
  nodes: ParsedNode[];
  edges: ParsedEdge[];
}

export interface DiagramParseIssue {
  /** 1-based line number, so it matches what the editor shows. */
  line: number;
  message: string;
  severity: "error" | "warning";
}

export interface DiagramParseResult {
  ok: boolean;
  diagram: ParsedDiagram;
  issues: DiagramParseIssue[];
}

/** Longest wrappers first, so `[(` is never mistaken for `[`. */
const SHAPE_WRAPPERS: { open: string; close: string; shape: DiagramNodeShape }[] = [
  { open: "([", close: "])", shape: "pill" },
  { open: "[[", close: "]]", shape: "rectangle" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "((", close: "))", shape: "circle" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rectangle" },
  { open: "(", close: ")", shape: "rounded" },
  { open: "{", close: "}", shape: "diamond" },
];

/** Longest operators first; each tolerates extra dashes or equals signs. */
const EDGE_OPERATORS: { pattern: RegExp; style: EdgeStyle; arrow: boolean }[] = [
  { pattern: /^-\.-+>/, style: "dashed", arrow: true },
  { pattern: /^-\.-+/, style: "dashed", arrow: false },
  { pattern: /^={2,}>/, style: "thick", arrow: true },
  { pattern: /^={3,}/, style: "thick", arrow: false },
  { pattern: /^-{2,}>/, style: "solid", arrow: true },
  { pattern: /^-{3,}/, style: "solid", arrow: false },
];

const DIRECTION_HEADER = /^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/i;
const NODE_KEY = /^[A-Za-z0-9_-]+/;

/** Statements MotioCode knows about but does not model; skipped with a note. */
const IGNORED_KEYWORDS = [
  "subgraph",
  "end",
  "classdef",
  "class",
  "style",
  "linkstyle",
  "click",
  "direction",
];

export function parseDiagramSource(source: string): DiagramParseResult {
  const issues: DiagramParseIssue[] = [];
  const nodeOrder: string[] = [];
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  let direction: LayoutDirection = "TB";
  let sawHeader = false;

  const upsertNode = (key: string, label: string | null, shape: DiagramNodeShape | null) => {
    const existing = nodes.get(key);

    if (!existing) {
      nodeOrder.push(key);
      nodes.set(key, { key, label: label ?? key, shape: shape ?? "rectangle" });
      return;
    }

    // A later mention carrying a label or shape refines the first one.
    if (label !== null) existing.label = label;
    if (shape !== null) existing.shape = shape;
  };

  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const withoutComment = rawLine.split("%%")[0];
    const line = withoutComment.trim().replace(/;$/, "").trim();
    if (line === "") return;

    const header = DIRECTION_HEADER.exec(line);
    if (header) {
      // Mermaid treats TD as a synonym for TB.
      const value = header[1].toUpperCase();
      direction = value === "TD" ? "TB" : (value as LayoutDirection);
      sawHeader = true;

      const remainder = line.slice(header[0].length).trim();
      if (remainder !== "") {
        issues.push({
          line: lineNumber,
          message: `Ignored "${remainder}" after the direction. Put statements on their own line.`,
          severity: "warning",
        });
      }
      return;
    }

    const firstWord = line.split(/\s|\[|\(|\{/)[0].toLowerCase();
    if (IGNORED_KEYWORDS.includes(firstWord)) {
      issues.push({
        line: lineNumber,
        message: `"${firstWord}" is not supported yet and was skipped.`,
        severity: "warning",
      });
      return;
    }

    const parsed = parseStatement(line, lineNumber);
    if (parsed.issue) {
      issues.push(parsed.issue);
      return;
    }

    for (const node of parsed.nodes) upsertNode(node.key, node.label, node.shape);
    edges.push(...parsed.edges);
  });

  if (!sawHeader && nodeOrder.length > 0) {
    issues.push({
      line: 1,
      message: 'No direction given. Add "flowchart LR" or "flowchart TB" on the first line.',
      severity: "warning",
    });
  }

  for (const edge of edges) {
    for (const end of [edge.source, edge.target]) {
      if (!nodes.has(end)) {
        issues.push({
          line: 1,
          message: `Edge refers to "${end}", which is not defined.`,
          severity: "error",
        });
      }
    }
  }

  const hasError = issues.some((issue) => issue.severity === "error");

  return {
    ok: !hasError && nodeOrder.length > 0,
    diagram: {
      direction,
      nodes: nodeOrder.map((key) => nodes.get(key)!),
      edges,
    },
    issues,
  };
}

interface StatementResult {
  nodes: { key: string; label: string | null; shape: DiagramNodeShape | null }[];
  edges: ParsedEdge[];
  issue?: DiagramParseIssue;
}

/**
 * Reads one line as `node (operator [label] node)*`, so chains work.
 */
function parseStatement(line: string, lineNumber: number): StatementResult {
  const nodes: StatementResult["nodes"] = [];
  const edges: ParsedEdge[] = [];

  let rest = line;

  const readNode = (): { key: string } | DiagramParseIssue => {
    rest = rest.trimStart();
    const keyMatch = NODE_KEY.exec(rest);

    if (!keyMatch) {
      return {
        line: lineNumber,
        message: `Expected a node name at "${rest.slice(0, 16) || "end of line"}".`,
        severity: "error",
      };
    }

    const key = keyMatch[0];
    rest = rest.slice(key.length);

    for (const wrapper of SHAPE_WRAPPERS) {
      if (!rest.startsWith(wrapper.open)) continue;

      const closeAt = rest.indexOf(wrapper.close, wrapper.open.length);
      if (closeAt === -1) {
        return {
          line: lineNumber,
          message: `"${key}" is missing its closing "${wrapper.close}".`,
          severity: "error",
        };
      }

      const label = rest.slice(wrapper.open.length, closeAt).trim();
      rest = rest.slice(closeAt + wrapper.close.length);
      nodes.push({ key, label: unquote(label), shape: wrapper.shape });
      return { key };
    }

    nodes.push({ key, label: null, shape: null });
    return { key };
  };

  const first = readNode();
  if ("severity" in first) return { nodes: [], edges: [], issue: first };

  let previousKey = first.key;

  while (true) {
    rest = rest.trimStart();
    if (rest === "") break;

    const operator = EDGE_OPERATORS.find((candidate) => candidate.pattern.test(rest));
    if (!operator) {
      return {
        nodes: [],
        edges: [],
        issue: {
          line: lineNumber,
          message: `Expected an arrow such as "-->" at "${rest.slice(0, 16)}".`,
          severity: "error",
        },
      };
    }

    rest = rest.replace(operator.pattern, "");

    let label = "";
    if (rest.startsWith("|")) {
      const closeAt = rest.indexOf("|", 1);
      if (closeAt === -1) {
        return {
          nodes: [],
          edges: [],
          issue: {
            line: lineNumber,
            message: "An edge label is missing its closing \"|\".",
            severity: "error",
          },
        };
      }
      label = unquote(rest.slice(1, closeAt).trim());
      rest = rest.slice(closeAt + 1);
    }

    const next = readNode();
    if ("severity" in next) return { nodes: [], edges: [], issue: next };

    edges.push({
      source: previousKey,
      target: next.key,
      label,
      style: operator.style,
      arrow: operator.arrow,
    });
    previousKey = next.key;
  }

  return { nodes, edges };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Turns a parsed graph back into Mermaid text, for seeding the editor. */
export function toDiagramSource(diagram: ParsedDiagram): string {
  const wrapperFor = (shape: DiagramNodeShape) =>
    SHAPE_WRAPPERS.find((wrapper) => wrapper.shape === shape) ?? SHAPE_WRAPPERS[5];

  const lines = [`flowchart ${diagram.direction}`];

  for (const node of diagram.nodes) {
    const wrapper = wrapperFor(node.shape);
    lines.push(`  ${node.key}${wrapper.open}${node.label}${wrapper.close}`);
  }

  for (const edge of diagram.edges) {
    const operator =
      edge.style === "dashed"
        ? edge.arrow
          ? "-.->"
          : "-.-"
        : edge.style === "thick"
          ? edge.arrow
            ? "==>"
            : "==="
          : edge.arrow
            ? "-->"
            : "---";

    const label = edge.label ? `|${edge.label}|` : "";
    lines.push(`  ${edge.source} ${operator}${label} ${edge.target}`);
  }

  return lines.join("\n");
}
