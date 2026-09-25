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

/**
 * Diagram and infographic element types are added here in Phase 3. The union
 * is the single extension point; nothing else in the engine needs to change.
 */
export const sceneElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  shapeElementSchema,
  codeElementSchema,
  imageElementSchema,
  calloutElementSchema,
]);

export type SceneElement = z.infer<typeof sceneElementSchema>;
export type ElementType = SceneElement["type"];
export type TextElement = z.infer<typeof textElementSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type CodeElement = z.infer<typeof codeElementSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type CalloutElement = z.infer<typeof calloutElementSchema>;

export const ELEMENT_TYPES: ElementType[] = ["text", "shape", "code", "image", "callout"];
