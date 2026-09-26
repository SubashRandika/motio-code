import type { Animation, AnimationType } from "./animation";
import type { CanvasConfig } from "./canvas";
import {
  elementStyleSchema,
  type AddableElementType,
  type CalloutElement,
  type CodeElement,
  type ElementType,
  type ImageElement,
  type NodeElement,
  type SceneElement,
  type ShapeElement,
  type TextElement,
} from "./element";
import { createId } from "./primitives";
import type { ThemeConfig } from "./theme";

const BASE_STYLE = elementStyleSchema.parse({});

/**
 * New elements are sized as a fraction of the canvas, so the same factory
 * produces something sensible on a 1920x1080 landscape and a 1080x1920 story.
 */
function centredRect(canvas: CanvasConfig, widthRatio: number, heightRatio: number, index: number) {
  const width = Math.round(canvas.width * widthRatio);
  const height = Math.round(canvas.height * heightRatio);
  // Cascade successive elements so a second one does not land exactly on the first.
  const offset = (index % 6) * Math.round(canvas.width * 0.02);

  return {
    x: Math.round((canvas.width - width) / 2) + offset,
    y: Math.round((canvas.height - height) / 2) + offset,
    width,
    height,
  };
}

export interface ElementFactoryContext {
  canvas: CanvasConfig;
  theme: ThemeConfig;
  /** How many elements the scene already has, used to cascade placement. */
  index: number;
}

const SAMPLE_CODE = `export function greet(name: string) {
  return \`Hello, \${name}\`;
}`;

export function createElement(
  type: AddableElementType,
  context: ElementFactoryContext,
): SceneElement {
  const { canvas, theme, index } = context;

  switch (type) {
    case "text": {
      const element: TextElement = {
        id: createId("el"),
        name: "Text",
        type: "text",
        rect: centredRect(canvas, 0.5, 0.12, index),
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: { ...BASE_STYLE },
        animations: [],
        content: {
          text: "Double-click to edit",
          font: "sans",
          fontSize: Math.round(canvas.height * 0.055),
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: -0.02,
          align: "left",
          color: theme.text,
          uppercase: false,
        },
      };
      return element;
    }

    case "shape": {
      const element: ShapeElement = {
        id: createId("el"),
        name: "Rectangle",
        type: "shape",
        rect: centredRect(canvas, 0.25, 0.18, index),
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: {
          ...BASE_STYLE,
          fill: theme.surface,
          stroke: theme.border,
          strokeWidth: 2,
          cornerRadius: 12,
        },
        animations: [],
        content: { shape: "rectangle" },
      };
      return element;
    }

    case "code": {
      const element: CodeElement = {
        id: createId("el"),
        name: "Code",
        type: "code",
        rect: centredRect(canvas, 0.55, 0.32, index),
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: {
          ...BASE_STYLE,
          fill: theme.surface,
          stroke: theme.border,
          strokeWidth: 1,
          cornerRadius: 10,
          shadow: true,
        },
        animations: [],
        content: {
          code: SAMPLE_CODE,
          language: "typescript",
          title: "example.ts",
          fontSize: Math.round(canvas.height * 0.022),
          lineHeight: 1.6,
          showLineNumbers: true,
          highlightedLines: [],
          showWindowChrome: true,
          revealUnit: "line",
          showCaret: false,
        },
      };
      return element;
    }

    case "callout": {
      const element: CalloutElement = {
        id: createId("el"),
        name: "Callout",
        type: "callout",
        rect: centredRect(canvas, 0.3, 0.12, index),
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: { ...BASE_STYLE, cornerRadius: 8 },
        animations: [],
        content: {
          label: "Note",
          body: "Explain what happens here.",
          tone: "accent",
          pointer: "none",
        },
      };
      return element;
    }

    case "node": {
      const element: NodeElement = {
        id: createId("nd"),
        name: "Service",
        type: "node",
        rect: centredRect(canvas, 0.16, 0.11, index),
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: {
          ...BASE_STYLE,
          fill: theme.surface,
          stroke: theme.border,
          strokeWidth: 2,
          cornerRadius: 10,
        },
        animations: [],
        content: {
          label: "Service",
          sublabel: "",
          shape: "rectangle",
          icon: "none",
          accent: null,
          fontSize: Math.max(12, Math.round(canvas.height * 0.024)),
          align: "center",
          sourceKey: null,
        },
      };
      return element;
    }

    case "image": {
      const element: ImageElement = {
        id: createId("el"),
        name: "Image",
        type: "image",
        rect: centredRect(canvas, 0.3, 0.25, index),
        layer: index,
        from: 0,
        durationInFrames: null,
        locked: false,
        hidden: false,
        style: { ...BASE_STYLE, cornerRadius: 8 },
        animations: [],
        content: { assetId: null, storagePath: null, alt: "", fit: "contain" },
      };
      return element;
    }
  }
}

/** Human labels for the element rail and the layer list. */
export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: "Text",
  shape: "Shape",
  code: "Code",
  callout: "Callout",
  image: "Image",
  node: "Node",
  connector: "Connector",
};

/** A new animation of the given type, with sensible starting values. */
export function createAnimation(type: AnimationType): Animation {
  const base = {
    id: createId("an"),
    trigger: "enter" as const,
    offsetInFrames: 0,
    durationInFrames: 20,
  };

  switch (type) {
    case "fade":
      return { ...base, type: "fade", easing: "easeOut", from: 0, to: 1 };
    case "slide":
      return { ...base, type: "slide", easing: "easeOut", direction: "up", distance: 48 };
    case "scale":
      return { ...base, type: "scale", easing: "easeOut", from: 0.92, to: 1 };
    case "highlight":
      return {
        ...base,
        type: "highlight",
        trigger: "at",
        durationInFrames: 30,
        easing: "easeInOut",
        color: "#F2A63B",
        intensity: 0.6,
      };
    case "emphasis":
      return {
        ...base,
        type: "emphasis",
        trigger: "at",
        durationInFrames: 24,
        easing: "easeInOut",
        peak: 1.06,
      };
    case "reveal":
      return {
        ...base,
        type: "reveal",
        durationInFrames: 45,
        easing: "linear",
        staggerInFrames: 4,
      };
    case "focus":
      return {
        ...base,
        type: "focus",
        trigger: "at",
        durationInFrames: 12,
        easing: "easeOut",
        fromPart: 1,
        toPart: 1,
        dim: 0.25,
        accent: "#F2A63B",
      };
    case "flow":
      return {
        ...base,
        type: "flow",
        durationInFrames: 60,
        easing: "linear",
        markers: 1,
        repeat: 2,
        color: "#57D2E0",
        size: 12,
      };
  }
}
