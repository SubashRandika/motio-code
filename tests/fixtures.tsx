import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import {
  canvasConfigSchema,
  elementStyleSchema,
  exportConfigSchema,
  themeConfigSchema,
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
    data: { elements: [], transition: null, background: null, notes: "" },
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
