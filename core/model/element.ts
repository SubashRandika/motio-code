import { z } from "zod";

import { animationSchema } from "./animation";
import { frameCountSchema, hexColorSchema, idSchema, rectSchema } from "./primitives";

export const CODE_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "csharp",
  "java",
  "sql",
  "json",
  "bash",
] as const;
export const codeLanguageSchema = z.enum(CODE_LANGUAGES);
export type CodeLanguage = z.infer<typeof codeLanguageSchema>;

export const fontRoleSchema = z.enum(["display", "sans", "mono"]);
export const textAlignSchema = z.enum(["left", "center", "right"]);

/** Styling shared by every element. Content-specific styling lives in `content`. */
export const elementStyleSchema = z.object({
  fill: hexColorSchema.nullable().default(null),
  stroke: hexColorSchema.nullable().default(null),
  strokeWidth: z.number().min(0).max(64).default(0),
  cornerRadius: z.number().min(0).max(512).default(0),
  opacity: z.number().min(0).max(1).default(1),
  padding: z.number().min(0).max(512).default(0),
  shadow: z.boolean().default(false),
});

export type ElementStyle = z.infer<typeof elementStyleSchema>;

const baseElement = {
  id: idSchema,
  name: z.string().min(1).max(120),
  rect: rectSchema,
  /** Stacking order within the scene. Higher draws on top. */
  layer: z.number().int().min(0).max(9999).default(0),
  /** First frame of the element, relative to the start of its scene. */
  from: frameCountSchema.default(0),
  /** `null` means "until the scene ends". */
  durationInFrames: frameCountSchema.min(1).nullable().default(null),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  style: elementStyleSchema,
  animations: z.array(animationSchema).max(24).default([]),
};

export const textElementSchema = z.object({
  ...baseElement,
  type: z.literal("text"),
  content: z.object({
    text: z.string().max(4000),
    font: fontRoleSchema.default("sans"),
    fontSize: z.number().min(8).max(400).default(48),
    fontWeight: z.number().int().min(100).max(900).default(500),
    lineHeight: z.number().min(0.8).max(3).default(1.25),
    letterSpacing: z.number().min(-0.1).max(0.5).default(0),
    align: textAlignSchema.default("left"),
    color: hexColorSchema.default("#E8ECF2"),
    uppercase: z.boolean().default(false),
  }),
});

export const shapeElementSchema = z.object({
  ...baseElement,
  type: z.literal("shape"),
  content: z.object({
    shape: z.enum(["rectangle", "ellipse", "line"]).default("rectangle"),
  }),
});

export const codeElementSchema = z.object({
  ...baseElement,
  type: z.literal("code"),
  content: z.object({
    code: z.string().max(20000),
    language: codeLanguageSchema.default("typescript"),
    title: z.string().max(120).default(""),
    fontSize: z.number().min(8).max(72).default(18),
    lineHeight: z.number().min(1).max(3).default(1.6),
    showLineNumbers: z.boolean().default(true),
    /** 1-based line numbers to emphasise. */
    highlightedLines: z.array(z.number().int().min(1).max(2000)).max(200).default([]),
    showWindowChrome: z.boolean().default(true),
  }),
});

export const imageElementSchema = z.object({
  ...baseElement,
  type: z.literal("image"),
  content: z.object({
    assetId: idSchema.nullable().default(null),
    storagePath: z.string().max(2048).nullable().default(null),
    alt: z.string().max(280).default(""),
    fit: z.enum(["cover", "contain"]).default("contain"),
  }),
});

export const calloutElementSchema = z.object({
  ...baseElement,
  type: z.literal("callout"),
  content: z.object({
    label: z.string().max(80).default(""),
    body: z.string().max(1000),
    tone: z.enum(["neutral", "accent", "warning"]).default("neutral"),
    pointer: z.enum(["none", "left", "right", "top", "bottom"]).default("none"),
  }),
});


/* ------------------------------------------------------------- diagram bits */

export const NODE_SIDES = ["top", "right", "bottom", "left"] as const;
export const nodeSideSchema = z.enum(NODE_SIDES);
export type NodeSide = z.infer<typeof nodeSideSchema>;

/** `auto` lets the router pick the side that gives the shortest route. */
export const CONNECTOR_ANCHORS = ["auto", ...NODE_SIDES] as const;
export const connectorAnchorSchema = z.enum(CONNECTOR_ANCHORS);
export type ConnectorAnchor = z.infer<typeof connectorAnchorSchema>;

export const CONNECTOR_KINDS = ["straight", "orthogonal", "curved"] as const;
export const connectorKindSchema = z.enum(CONNECTOR_KINDS);
export type ConnectorKind = z.infer<typeof connectorKindSchema>;

export const DIAGRAM_NODE_SHAPES = [
  "rectangle",
  "rounded",
  "pill",
  "diamond",
  "cylinder",
  "circle",
  "hexagon",
] as const;
export const diagramNodeShapeSchema = z.enum(DIAGRAM_NODE_SHAPES);
export type DiagramNodeShape = z.infer<typeof diagramNodeShapeSchema>;

/**
 * A small, vendor-neutral icon set. Cloud-provider icon libraries are a later
 * phase; these cover the shapes a technical diagram usually needs.
 */
export const NODE_ICONS = [
  "none",
  "server",
  "database",
  "cloud",
  "user",
  "queue",
  "function",
  "cache",
  "browser",
  "api",
  "storage",
  "lock",
  "container",
  "event",
] as const;
export const nodeIconSchema = z.enum(NODE_ICONS);
export type NodeIcon = z.infer<typeof nodeIconSchema>;

export const nodeElementSchema = z.object({
  ...baseElement,
  type: z.literal("node"),
  content: z.object({
    label: z.string().max(200),
    sublabel: z.string().max(200).default(""),
    shape: diagramNodeShapeSchema.default("rectangle"),
    icon: nodeIconSchema.default("none"),
    /** Overrides the theme accent for this node only. */
    accent: hexColorSchema.nullable().default(null),
    fontSize: z.number().min(8).max(200).default(28),
    align: textAlignSchema.default("center"),
    /**
     * The id this node had in the text definition. Re-applying edited text
     * matches on this so a hand-arranged position survives.
     */
    sourceKey: z.string().max(80).nullable().default(null),
  }),
});

export const connectorElementSchema = z.object({
  ...baseElement,
  type: z.literal("connector"),
  content: z.object({
    sourceId: idSchema,
    targetId: idSchema,
    sourceAnchor: connectorAnchorSchema.default("auto"),
    targetAnchor: connectorAnchorSchema.default("auto"),
    kind: connectorKindSchema.default("orthogonal"),
    label: z.string().max(200).default(""),
    startArrow: z.boolean().default(false),
    endArrow: z.boolean().default(true),
    dashed: z.boolean().default(false),
    thickness: z.number().min(1).max(24).default(2),
  }),
});

/**
 * The single extension point for new element kinds. Infographic types join the
 * union in the next step; nothing else in the engine needs to change.
 */
export const sceneElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  shapeElementSchema,
  codeElementSchema,
  imageElementSchema,
  calloutElementSchema,
  nodeElementSchema,
  connectorElementSchema,
]);

export type SceneElement = z.infer<typeof sceneElementSchema>;
export type ElementType = SceneElement["type"];
export type TextElement = z.infer<typeof textElementSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type CodeElement = z.infer<typeof codeElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type CalloutElement = z.infer<typeof calloutElementSchema>;
export type NodeElement = z.infer<typeof nodeElementSchema>;
export type ConnectorElement = z.infer<typeof connectorElementSchema>;

export const ELEMENT_TYPES: ElementType[] = [
  "text",
  "shape",
  "code",
  "image",
  "callout",
  "node",
  "connector",
];

/**
 * A connector is drawn between two existing nodes, never added on its own, so
 * it is excluded from the factory's input type rather than left as a branch
 * that can only produce an invalid element.
 */
export type AddableElementType = Exclude<ElementType, "connector">;

export const ADDABLE_ELEMENT_TYPES: AddableElementType[] = [
  "text",
  "code",
  "shape",
  "callout",
  "node",
  "image",
];

export function isNode(element: SceneElement): element is NodeElement {
  return element.type === "node";
}

export function isConnector(element: SceneElement): element is ConnectorElement {
  return element.type === "connector";
}
