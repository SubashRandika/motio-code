import { describe, expect, it } from "vitest";

import { buildTimeline } from "@/core/animation";
import { parseDiagramSource } from "@/core/diagram";
import {
  ASPECT_RATIOS,
  canvasForAspectRatio,
  isConnector,
  isNode,
  sceneSchema,
  themeConfigSchema,
  type CanvasConfig,
  type Scene,
} from "@/core/model";
import { TEMPLATES, findTemplate, templatesFor, type Template } from "@/core/templates";

const THEME = themeConfigSchema.parse({});

function contextFor(ratio: (typeof ASPECT_RATIOS)[number]): {
  canvas: CanvasConfig;
  theme: typeof THEME;
} {
  return { canvas: canvasForAspectRatio(ratio, 30), theme: THEME };
}

const LANDSCAPE = contextFor("16:9");

/** Every element in a template, across all its scenes. */
function allElements(scenes: Scene[]) {
  return scenes.flatMap((scene) => scene.data.elements);
}

describe("the template catalogue", () => {
  it("offers the ten AGENTS.md names", () => {
    expect(TEMPLATES).toHaveLength(10);
    expect(TEMPLATES.map((template) => template.id)).toEqual([
      "code-walkthrough",
      "before-after-code",
      "api-request-lifecycle",
      "microservices-architecture",
      "cloud-infrastructure",
      "database-query-execution",
      "event-driven-architecture",
      "authentication-flow",
      "data-pipeline",
      "technical-concept-infographic",
    ]);
  });

  it("has a unique, stable id for each, because it is stored on the project", () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("finds a template by id and nothing by a wrong one", () => {
    expect(findTemplate("data-pipeline")?.name).toBe("Data pipeline");
    expect(findTemplate("no-such-template")).toBeNull();
  });

  it("offers at least one for every content type, so no choice is a dead end", () => {
    for (const contentType of ["code", "diagram", "infographic", "mixed"] as const) {
      expect(templatesFor(contentType).length, contentType).toBeGreaterThan(0);
    }
  });

  it("accounts for every template across the content types", () => {
    const counted = (["code", "diagram", "infographic", "mixed"] as const).flatMap(templatesFor);
    expect(counted).toHaveLength(TEMPLATES.length);
  });

  it("has a name and a description for each, since the card shows both", () => {
    for (const template of TEMPLATES) {
      expect(template.name.length, template.id).toBeGreaterThan(0);
      expect(template.description.length, template.id).toBeGreaterThan(10);
    }
  });
});

describe.each(TEMPLATES.map((template) => [template.id, template] as const))(
  "the %s template",
  (id: string, template: Template) => {
    const scenes = template.build(LANDSCAPE);

    it("builds at least two scenes", () => {
      expect(scenes.length).toBeGreaterThanOrEqual(2);
    });

    it("produces scenes the schema accepts", () => {
      for (const scene of scenes) {
        const parsed = sceneSchema.safeParse(scene);
        expect(parsed.success, `${id}: ${JSON.stringify(parsed.error?.issues?.[0])}`).toBe(true);
      }
    });

    it("numbers the scenes from zero with no gaps", () => {
      expect(scenes.map((scene) => scene.order)).toEqual(scenes.map((_, index) => index));
    });

    it("gives every scene a distinct uuid", () => {
      const ids = scenes.map((scene) => scene.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const sceneId of ids) {
        expect(sceneId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    });

    it("gives every element a distinct id", () => {
      const ids = allElements(scenes).map((element) => element.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("numbers layers from zero within each scene", () => {
      for (const scene of scenes) {
        const layers = scene.data.elements.map((element) => element.layer);
        expect(layers).toEqual(layers.map((_, index) => index));
      }
    });

    it("puts something in every scene", () => {
      for (const scene of scenes) {
        expect(scene.data.elements.length, scene.name).toBeGreaterThan(0);
      }
    });

    it("keeps every animation inside the scene it belongs to", () => {
      for (const scene of scenes) {
        for (const element of scene.data.elements) {
          for (const animation of element.animations) {
            const end = element.from + animation.offsetInFrames + animation.durationInFrames;
            expect(
              end,
              `${scene.name}/${element.name}/${animation.type}`,
            ).toBeLessThanOrEqual(scene.durationInFrames);
          }
        }
      }
    });

    it("starts every element inside its scene", () => {
      for (const scene of scenes) {
        for (const element of scene.data.elements) {
          expect(element.from, `${scene.name}/${element.name}`).toBeLessThan(
            scene.durationInFrames,
          );
        }
      }
    });

    it("builds a timeline that runs for a sensible length", () => {
      const timeline = buildTimeline(scenes);
      expect(timeline.durationInFrames).toBeGreaterThan(30);
      // Nothing here should be longer than a minute at 30fps.
      expect(timeline.durationInFrames).toBeLessThan(1800);
    });

    it("leaves no connector without its nodes", () => {
      for (const scene of scenes) {
        const nodeIds = new Set(scene.data.elements.filter(isNode).map((node) => node.id));

        for (const connector of scene.data.elements.filter(isConnector)) {
          expect(nodeIds.has(connector.content.sourceId), scene.name).toBe(true);
          expect(nodeIds.has(connector.content.targetId), scene.name).toBe(true);
        }
      }
    });

    it("paints routes beneath the boxes they join", () => {
      for (const scene of scenes) {
        const connectors = scene.data.elements.filter(isConnector);
        const nodes = scene.data.elements.filter(isNode);
        if (connectors.length === 0 || nodes.length === 0) continue;

        const highestRoute = Math.max(...connectors.map((item) => item.layer));
        const lowestNode = Math.min(...nodes.map((item) => item.layer));
        expect(highestRoute, scene.name).toBeLessThan(lowestNode);
      }
    });

    it("keeps any stored diagram text in step with the nodes it produced", () => {
      for (const scene of scenes) {
        const diagram = scene.data.diagram;
        if (!diagram) continue;

        const parsed = parseDiagramSource(diagram.source);
        expect(parsed.ok, scene.name).toBe(true);
        expect(scene.data.elements.filter(isNode)).toHaveLength(parsed.diagram.nodes.length);
        expect(scene.data.elements.filter(isConnector)).toHaveLength(parsed.diagram.edges.length);
      }
    });

    it("lays out inside the canvas on every aspect ratio the product offers", () => {
      for (const ratio of ASPECT_RATIOS) {
        const context = contextFor(ratio);
        const built = template.build(context);

        for (const element of allElements(built)) {
          // A diagram's own layout centres itself, so only authored placements
          // are checked against the edges here.
          if (isConnector(element)) continue;

          expect(element.rect.x, `${ratio}/${element.name}`).toBeGreaterThanOrEqual(0);
          expect(element.rect.y, `${ratio}/${element.name}`).toBeGreaterThanOrEqual(0);
          expect(
            element.rect.x + element.rect.width,
            `${ratio}/${element.name}`,
          ).toBeLessThanOrEqual(context.canvas.width);
          expect(
            element.rect.y + element.rect.height,
            `${ratio}/${element.name}`,
          ).toBeLessThanOrEqual(context.canvas.height);
        }
      }
    });

    it("builds fresh ids each time, so two projects never collide", () => {
      const again = template.build(LANDSCAPE);
      expect(again[0].id).not.toBe(scenes[0].id);
      expect(again[0].data.elements[0].id).not.toBe(scenes[0].data.elements[0].id);
    });
  },
);

describe("a diagram template's animation ordering", () => {
  const scenes = findTemplate("api-request-lifecycle")!.build(LANDSCAPE);
  const diagramSceneData = scenes.find((scene) => scene.data.diagram !== null)!.data;

  it("staggers the boxes rather than showing them all at once", () => {
    const offsets = diagramSceneData.elements
      .filter(isNode)
      .map((node) => node.animations[0]?.offsetInFrames ?? 0);

    expect(new Set(offsets).size).toBeGreaterThan(1);
    expect(Math.min(...offsets)).toBe(0);
  });

  it("draws a route only once both of its boxes have arrived", () => {
    const nodes = diagramSceneData.elements.filter(isNode);
    const arrival = new Map(
      nodes.map((node) => [
        node.id,
        (node.animations[0]?.offsetInFrames ?? 0) + (node.animations[0]?.durationInFrames ?? 0),
      ]),
    );

    for (const connector of diagramSceneData.elements.filter(isConnector)) {
      const draw = connector.animations.find((animation) => animation.type === "reveal");
      expect(draw).toBeDefined();

      const bothIn = Math.max(
        arrival.get(connector.content.sourceId) ?? 0,
        arrival.get(connector.content.targetId) ?? 0,
      );
      expect(draw!.offsetInFrames).toBeGreaterThanOrEqual(bothIn);
    }
  });

  it("sends flow markers only after the route has been drawn", () => {
    for (const connector of diagramSceneData.elements.filter(isConnector)) {
      const draw = connector.animations.find((animation) => animation.type === "reveal")!;
      const flow = connector.animations.find((animation) => animation.type === "flow");
      if (!flow) continue;

      expect(flow.offsetInFrames).toBeGreaterThanOrEqual(
        draw.offsetInFrames + draw.durationInFrames,
      );
    }
  });
});
