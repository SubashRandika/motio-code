import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import {
  canvasConfigSchema,
  elementStyleSchema,
  exportConfigSchema,
  themeConfigSchema,
  type CodeElement,
  type ConnectorElement,
  type NodeElement,
  type Project,
  type Scene,
  type TextElement,
} from "@/core/model";
import { EditorStoreBridge } from "@/features/editor/store-provider";
import type { EditorStoreApi } from "@/features/editor/store";

export function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Opening",
    order: 0,
    durationInFrames: 150,
    data: { elements: [], transition: null, background: null, notes: "", diagram: null },
    ...overrides,
  };
}

export function makeTextElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: "el_1",
    name: "Text",
    type: "text",
    rect: { x: 100, y: 100, width: 400, height: 120 },
    layer: 0,
    from: 0,
    durationInFrames: null,
    locked: false,
    hidden: false,
    style: elementStyleSchema.parse({}),
    animations: [],
    content: {
      text: "Hello",
      font: "sans",
      fontSize: 48,
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: 0,
      align: "left",
      color: "#E8ECF2",
      uppercase: false,
    },
    ...overrides,
  };
}

export function makeCodeElement(
  overrides: Partial<Omit<CodeElement, "content">> & {
    content?: Partial<CodeElement["content"]>;
  } = {},
): CodeElement {
  return {
    id: "el_code",
    name: "Code",
    type: "code",
    rect: { x: 40, y: 40, width: 900, height: 500 },
    layer: 0,
    from: 0,
    durationInFrames: null,
    locked: false,
    hidden: false,
    style: { ...elementStyleSchema.parse({}), fill: "#151A22", stroke: "#2A3340", strokeWidth: 1 },
    animations: [],
    ...overrides,
    content: {
      code: ["const a = 1;", "const b = 2;", "return a + b;"].join("\n"),
      language: "typescript",
      title: "example.ts",
      fontSize: 18,
      lineHeight: 1.6,
      showLineNumbers: true,
      highlightedLines: [],
      showWindowChrome: true,
      revealUnit: "line",
      showCaret: false,
      ...overrides.content,
    },
  };
}

export function makeNodeElement(overrides: Partial<NodeElement> = {}): NodeElement {
  return {
    id: "nd_1",
    name: "Gateway",
    type: "node",
    rect: { x: 100, y: 100, width: 200, height: 100 },
    layer: 0,
    from: 0,
    durationInFrames: null,
    locked: false,
    hidden: false,
    style: { ...elementStyleSchema.parse({}), fill: "#151A22", stroke: "#2A3340", strokeWidth: 2 },
    animations: [],
    content: {
      label: "Gateway",
      sublabel: "",
      shape: "rectangle",
      icon: "none",
      accent: null,
      fontSize: 24,
      align: "center",
      sourceKey: null,
    },
    ...overrides,
  };
}

export function makeConnectorElement(
  overrides: Partial<Omit<ConnectorElement, "content">> & {
    content?: Partial<ConnectorElement["content"]>;
  } = {},
): ConnectorElement {
  return {
    id: "cn_1",
    name: "Gateway to Service",
    type: "connector",
    rect: { x: 0, y: 0, width: 1, height: 1 },
    layer: 0,
    from: 0,
    durationInFrames: null,
    locked: false,
    hidden: false,
    style: { ...elementStyleSchema.parse({}), stroke: "#8A97A8", strokeWidth: 2 },
    animations: [],
    ...overrides,
    content: {
      sourceId: "nd_1",
      targetId: "nd_2",
      sourceAnchor: "auto",
      targetAnchor: "auto",
      kind: "orthogonal",
      label: "",
      startArrow: false,
      endArrow: true,
      dashed: false,
      thickness: 2,
      ...overrides.content,
    },
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11",
    ownerId: "8b1d2c3e-1d1a-4a4b-9f6c-2f4a1d6b8c12",
    name: "Auth flow walkthrough",
    description: null,
    contentType: "code",
    templateId: null,
    thumbnailPath: null,
    dataVersion: 1,
    lastOpenedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    canvas: canvasConfigSchema.parse({}),
    theme: themeConfigSchema.parse({}),
    export: exportConfigSchema.parse({}),
    scenes: [
      makeScene(),
      makeScene({
        id: "22222222-2222-4222-8222-222222222222",
        name: "The check",
        order: 1,
        durationInFrames: 90,
      }),
    ],
    ...overrides,
  };
}

/** Renders a component against a store the test already owns. */
export function renderWithStore(ui: ReactElement, store: EditorStoreApi) {
  return render(<EditorStoreBridge store={store}>{ui}</EditorStoreBridge>);
}
