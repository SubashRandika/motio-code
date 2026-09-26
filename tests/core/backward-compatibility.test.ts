import { describe, expect, it } from "vitest";

import { sceneDataSchema } from "@/core/model";
import { rowToSceneData } from "@/features/projects/mappers";

/**
 * A scene saved before the diagram element types existed.
 *
 * Kept verbatim so that adding to the element union or the scene schema can
 * never silently break a project that is already stored. Any new field must
 * carry a default; any new element type must be additive.
 */
const SCENE_BEFORE_DIAGRAMS = {
  notes: "",
  elements: [
    {
      id: "el_d6de7dab",
      from: 0,
      name: "Code",
      rect: { x: 54, y: 26, width: 1813, height: 1028 },
      type: "code",
      layer: 0,
      style: {
        fill: "#151A22",
        shadow: true,
        stroke: "#2A3340",
        opacity: 1,
        padding: 0,
        strokeWidth: 1,
        cornerRadius: 10,
      },
      hidden: false,
      locked: false,
      content: {
        code: "export function greet(name: string) {\n  return `Hello, ${name}`;\n}",
        title: "example.ts",
        fontSize: 24,
        language: "typescript",
        lineHeight: 1.6,
        showLineNumbers: true,
        highlightedLines: [2],
        showWindowChrome: true,
      },
      animations: [],
      durationInFrames: null,
    },
  ],
  background: null,
  transition: null,
};

describe("a scene stored before diagrams existed", () => {
  it("still parses", () => {
    expect(sceneDataSchema.safeParse(SCENE_BEFORE_DIAGRAMS).success).toBe(true);
  });

  it("gains the new field as a default rather than failing", () => {
    const parsed = sceneDataSchema.parse(SCENE_BEFORE_DIAGRAMS);
    expect(parsed.diagram).toBeNull();
  });

  it("keeps its element intact through the row mapper", () => {
    const data = rowToSceneData(SCENE_BEFORE_DIAGRAMS);

    expect(data.elements).toHaveLength(1);
    expect(data.elements[0].type).toBe("code");
    expect(data.elements[0].id).toBe("el_d6de7dab");
    expect(data.elements[0].rect).toEqual({ x: 54, y: 26, width: 1813, height: 1028 });
  });

  it("survives the mapper's connector pruning even with no connectors", () => {
    expect(rowToSceneData(SCENE_BEFORE_DIAGRAMS).elements).toHaveLength(1);
  });

  it("falls back to an empty scene rather than throwing on a corrupt blob", () => {
    const data = rowToSceneData({ elements: "not an array" });
    expect(data.elements).toEqual([]);
    expect(data.diagram).toBeNull();
  });
});
