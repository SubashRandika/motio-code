import { fadeIn, flowAlong, revealParts, scaleIn } from "@/core/animation";
import { compileDiagram, parseDiagramSource } from "@/core/diagram";
import { assignLayers } from "@/core/editing";
import {
  createElement,
  createUuid,
  type AddableElementType,
  type Animation,
  type CanvasConfig,
  type ElementStyle,
  type NodeElement,
  type Rect,
  type Scene,
  type SceneElement,
  type ThemeConfig,
} from "@/core/model";

/**
 * The building blocks a template is written with.
 *
 * Two rules the helpers exist to enforce:
 *
 * 1. **A template never writes an element literal.** Everything goes through
 *    `createElement` and is then patched, so a template cannot produce an element
 *    the schema would reject, and a new required field gets a value for free.
 * 2. **A template never writes a pixel.** Positions are fractions of the canvas,
 *    so the same template lays out sensibly on a 1920x1080 landscape and a
 *    1080x1920 story. A template with hard-coded pixels would be unusable on
 *    three of the four aspect ratios the product offers.
 */

export interface TemplateContext {
  canvas: CanvasConfig;
  theme: ThemeConfig;
}

/** A box in fractions of the canvas, 0-1. */
export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function place(canvas: CanvasConfig, at: Placement): Rect {
  return {
    x: Math.round(canvas.width * at.x),
    y: Math.round(canvas.height * at.y),
    width: Math.round(canvas.width * at.width),
    height: Math.round(canvas.height * at.height),
  };
}

/** Seconds expressed in frames, so templates read in time rather than counts. */
export function seconds(canvas: CanvasConfig, value: number): number {
  return Math.max(1, Math.round(canvas.fps * value));
}

export interface ElementSpec<T extends SceneElement> {
  name?: string;
  at: Placement;
  from?: number;
  durationInFrames?: number | null;
  content?: Partial<T["content"]>;
  style?: Partial<ElementStyle>;
  animations?: Animation[];
}

/** A factory-built element, placed and patched. */
export function make<T extends SceneElement>(
  type: T["type"] & AddableElementType,
  context: TemplateContext,
  spec: ElementSpec<T>,
): T {
  const base = createElement(type, { canvas: context.canvas, theme: context.theme, index: 0 });

  return {
    ...base,
    name: spec.name ?? base.name,
    rect: place(context.canvas, spec.at),
    from: spec.from ?? 0,
    durationInFrames: spec.durationInFrames === undefined ? null : spec.durationInFrames,
    style: { ...base.style, ...spec.style },
    animations: spec.animations ?? [],
    content: { ...base.content, ...spec.content },
  } as T;
}

/**
 * A scene from an ordered list of elements.
 *
 * Layers come from the array order, so the template reads back-to-front the way
 * it is written.
 */
export function sceneOf(options: {
  name: string;
  durationInFrames: number;
  elements: SceneElement[];
  notes?: string;
}): Scene {
  return {
    id: createUuid(),
    name: options.name,
    // Set by the caller when the scenes are assembled.
    order: 0,
    durationInFrames: options.durationInFrames,
    data: {
      elements: assignLayers(options.elements),
      transition: null,
      background: null,
      notes: options.notes ?? "",
      diagram: null,
    },
  };
}

export interface DiagramSceneOptions {
  name: string;
  durationInFrames: number;
  /** Mermaid-subset text. Stored on the scene so the user can keep editing it. */
  source: string;
  /** Boxes arrive one after another rather than all at once. */
  revealNodes?: { durationInFrames: number; staggerInFrames: number };
  /** Markers travel every route once its nodes are in. */
  flowRoutes?: { durationInFrames: number; markers?: number; repeat?: number };
  /** Anything drawn on top of the diagram: a title, a caption. */
  overlay?: SceneElement[];
  notes?: string;
}

/**
 * A scene whose diagram is compiled from text.
 *
 * The template supplies only the definition; routing and layout come from the
 * same code path the diagram panel uses, and the text is stored so the user can
 * open the panel and keep editing it. A definition that does not parse is a bug
 * in the template, which is why this throws rather than degrading.
 */
export function diagramScene(
  context: TemplateContext,
  options: DiagramSceneOptions,
): Scene {
  const parsed = parseDiagramSource(options.source);
  if (!parsed.ok) {
    const first = parsed.issues.find((issue) => issue.severity === "error");
    throw new Error(
      `Template diagram does not parse at line ${first?.line ?? "?"}: ${first?.message ?? "unknown"}`,
    );
  }

  const { nodes, connectors } = compileDiagram(parsed.diagram, {
    canvas: context.canvas,
    theme: context.theme,
    existing: [],
  });

  const animated = animateDiagram(context, nodes, connectors, options);

  return {
    id: createUuid(),
    name: options.name,
    order: 0,
    durationInFrames: options.durationInFrames,
    data: {
      // Routes below boxes, overlay above both.
      elements: assignLayers([...animated.connectors, ...animated.nodes, ...(options.overlay ?? [])]),
      transition: null,
      background: null,
      notes: options.notes ?? "",
      diagram: { source: options.source, appliedAt: new Date().toISOString() },
    },
  };
}

/**
 * Staggers the boxes, then draws each route once both of its boxes are in.
 *
 * A route's offset follows the later of the two nodes it joins, so an arrow never
 * appears before the thing it points at.
 */
function animateDiagram(
  context: TemplateContext,
  nodes: NodeElement[],
  connectors: SceneElement[],
  options: DiagramSceneOptions,
): { nodes: SceneElement[]; connectors: SceneElement[] } {
  const reveal = options.revealNodes;
  if (!reveal) return { nodes, connectors };

  const arrival = new Map(nodes.map((node, index) => [node.id, index * reveal.staggerInFrames]));

  const animatedNodes = nodes.map((node) => {
    const at = arrival.get(node.id) ?? 0;
    return {
      ...node,
      animations: [
        fadeIn(reveal.durationInFrames, { offsetInFrames: at }),
        scaleIn(reveal.durationInFrames, 0.94, { offsetInFrames: at }),
      ],
    };
  });

  const animatedConnectors = connectors.map((connector) => {
    if (connector.type !== "connector") return connector;

    const source = arrival.get(connector.content.sourceId) ?? 0;
    const target = arrival.get(connector.content.targetId) ?? 0;
    const after = Math.max(source, target) + reveal.durationInFrames;

    const animations: Animation[] = [
      revealParts(reveal.durationInFrames, 0, { offsetInFrames: after }),
    ];

    if (options.flowRoutes) {
      animations.push(
        flowFor(context, options.flowRoutes, after + reveal.durationInFrames),
      );
    }

    return { ...connector, animations };
  });

  return { nodes: animatedNodes, connectors: animatedConnectors };
}

function flowFor(
  context: TemplateContext,
  flow: NonNullable<DiagramSceneOptions["flowRoutes"]>,
  offsetInFrames: number,
): Animation {
  return flowAlong({
    durationInFrames: flow.durationInFrames,
    offsetInFrames,
    // The alt accent is the product's "data in motion" colour; the routes
    // themselves are drawn in the muted one.
    color: context.theme.accentAlt,
    markers: flow.markers,
    repeat: flow.repeat,
    size: Math.max(6, Math.round(context.canvas.height * 0.012)),
  });
}

/** Numbers the scenes in the order the template listed them. */
export function ordered(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => ({ ...scene, order: index }));
}
