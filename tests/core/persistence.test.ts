import { describe, expect, it } from "vitest";

import {
  ADDABLE_ELEMENT_TYPES,
  canvasConfigSchema,
  createAnimation,
  elementStyleSchema,
  createElement,
  isNode,
  sceneDataSchema,
  themeConfigSchema,
  type AddableElementType,
  type ConnectorElement,
  type SceneData,
} from "@/core/model";
import { projectSavePayloadSchema } from "@/features/projects/schema";

import { makeProject } from "../fixtures";

const canvas = canvasConfigSchema.parse({});
const theme = themeConfigSchema.parse({});

function sceneWithEveryElementType(): SceneData {
  const elements = ADDABLE_ELEMENT_TYPES.map((type: AddableElementType, index) => {
    const element = createElement(type, { canvas, theme, index });
    return {
      ...element,
      animations: [createAnimation("fade"), createAnimation("slide")],
    };
  });

  // A connector is never produced by the factory -- it is drawn between two
  // existing nodes -- so build one here to cover the whole union.
  const firstNode = elements.find(isNode)!;
  const secondNode = createElement("node", { canvas, theme, index: elements.length });

  const connector: ConnectorElement = {
    id: "cn_1",
    name: "Connector",
    type: "connector",
    rect: { x: 0, y: 0, width: 1, height: 1 },
    layer: elements.length + 1,
    from: 0,
    durationInFrames: null,
    locked: false,
    hidden: false,
    style: elementStyleSchema.parse({}),
    animations: [createAnimation("flow")],
    content: {
      sourceId: firstNode.id,
      targetId: secondNode.id,
      sourceAnchor: "auto",
      targetAnchor: "auto",
      kind: "orthogonal",
      label: "yes",
      startArrow: false,
      endArrow: true,
      dashed: false,
      thickness: 2,
    },
  };

  return {
    elements: [...elements, secondNode, connector],
    transition: null,
    background: null,
    notes: "",
    diagram: null,
  };
}

describe("scene data round trip", () => {
  it("accepts everything the element factories produce", () => {
    const result = sceneDataSchema.safeParse(sceneWithEveryElementType());
    expect(result.success).toBe(true);
  });

  it("survives a trip through JSON without losing or changing anything", () => {
    const original = sceneDataSchema.parse(sceneWithEveryElementType());

    // This is exactly what the database does to scene_data.
    const stored = JSON.parse(JSON.stringify(original));
    const reloaded = sceneDataSchema.parse(stored);

    expect(reloaded).toEqual(original);
  });

  it("keeps every animation type intact", () => {
    const element = createElement("text", { canvas, theme, index: 0 });
    const withAnimations = {
      ...element,
      animations: (
        ["fade", "slide", "scale", "highlight", "emphasis", "reveal", "flow"] as const
      ).map(createAnimation),
    };

    const parsed = sceneDataSchema.parse({ elements: [withAnimations] });
    expect(parsed.elements[0].animations.map((a) => a.type)).toEqual([
      "fade",
      "slide",
      "scale",
      "highlight",
      "emphasis",
      "reveal",
      "flow",
    ]);
  });
});

describe("projectSavePayloadSchema", () => {
  function payloadFor(data: SceneData) {
    const project = makeProject();
    return {
      projectId: project.id,
      name: project.name,
      description: null,
      canvas: project.canvas,
      theme: project.theme,
      export: project.export,
      scenes: [
        {
          id: project.scenes[0].id,
          name: project.scenes[0].name,
          order: 0,
          durationInFrames: project.scenes[0].durationInFrames,
          data,
        },
      ],
    };
  }

  it("accepts what the editor sends", () => {
    const result = projectSavePayloadSchema.safeParse(payloadFor(sceneWithEveryElementType()));
    expect(result.success).toBe(true);
  });

  it("rejects a project with no scenes", () => {
    const payload = { ...payloadFor(sceneWithEveryElementType()), scenes: [] };
    const result = projectSavePayloadSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("A project needs at least one scene");
  });

  it("rejects a scene id that is not a uuid", () => {
    const payload = payloadFor(sceneWithEveryElementType());
    payload.scenes[0].id = "scn_not_a_uuid";
    expect(projectSavePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an element the schema does not know", () => {
    const payload = payloadFor({
      elements: [{ type: "hologram" }],
      transition: null,
      background: null,
      notes: "",
      diagram: null,
    } as unknown as SceneData);

    expect(projectSavePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a zero-length scene", () => {
    const payload = payloadFor(sceneWithEveryElementType());
    payload.scenes[0].durationInFrames = 0;
    expect(projectSavePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a blank project name", () => {
    const payload = { ...payloadFor(sceneWithEveryElementType()), name: "   " };
    expect(projectSavePayloadSchema.safeParse(payload).success).toBe(false);
  });
});
