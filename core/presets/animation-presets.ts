import {
  elementEndFrame,
  fadeIn,
  fadeOut,
  focusRange,
  revealParts,
  slideFrom,
} from "@/core/animation";
import { codeLines, typewriterFrames } from "@/core/code";
import {
  createId,
  type Animation,
  type CanvasConfig,
  type CodeElement,
  type ElementType,
  type SceneElement,
  type ThemeConfig,
} from "@/core/model";

/**
 * Named animation presets.
 *
 * A preset is a *starting point*, not a fixed effect: it writes plain
 * animations and content settings the user can then open in the properties
 * panel and change. Nothing here is a new engine feature, which is the point --
 * if a preset needed a capability the animation model does not have, the model
 * is what should grow.
 *
 * Applying a preset **replaces** the element's animations. A preset means "make
 * this read like a typewriter", and layering that onto whatever was already
 * there would produce something nobody asked for. It is one undo step.
 *
 * Two of the six are scene-scoped. A before-and-after comparison and a
 * sequential transformation are not one element animating; they are two panels
 * arranged in space or in time. Pretending otherwise would have meant an
 * element preset that silently created elements.
 */

export type PresetScope = "element" | "scene";

export interface PresetContext {
  canvas: CanvasConfig;
  theme: ThemeConfig;
  sceneDurationInFrames: number;
  fps: number;
}

interface PresetBase {
  id: string;
  label: string;
  /** One line, shown under the button. Says what the preset will do. */
  description: string;
  appliesTo: readonly ElementType[];
}

export interface ElementPreset extends PresetBase {
  scope: "element";
  apply: (element: SceneElement, context: PresetContext) => SceneElement;
}

export interface ScenePreset extends PresetBase {
  scope: "scene";
  /** Returns the scene's whole element list. Layers are renumbered by the caller. */
  apply: (
    element: SceneElement,
    elements: SceneElement[],
    context: PresetContext,
  ) => SceneElement[];
}

export type Preset = ElementPreset | ScenePreset;

/* ------------------------------------------------------------------ helpers */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Frames the element is on screen for, which is what a preset has to fit in. */
function life(element: SceneElement, context: PresetContext): number {
  const end = elementEndFrame(element, context.sceneDurationInFrames);
  return Math.max(1, end - element.from);
}

/** The lines a focus should land on when the user has not said. */
function middleRange(lineCount: number): { fromPart: number; toPart: number } {
  if (lineCount <= 2) return { fromPart: 1, toPart: lineCount };
  const from = Math.floor(lineCount / 3) + 1;
  return { fromPart: from, toPart: Math.min(lineCount, from + Math.ceil(lineCount / 3) - 1) };
}

function codePanel(
  element: CodeElement,
  patch: {
    name: string;
    titlePrefix: string;
    rect?: CodeElement["rect"];
    from: number;
    durationInFrames: number | null;
    animations: Animation[];
  },
): CodeElement {
  return {
    ...element,
    id: createId("el"),
    name: patch.name,
    rect: patch.rect ?? element.rect,
    from: patch.from,
    durationInFrames: patch.durationInFrames,
    animations: patch.animations,
    content: {
      ...element.content,
      // The window bar already exists, so the stage label goes there rather
      // than costing the scene two extra text elements.
      title: element.content.title
        ? `${patch.titlePrefix} · ${element.content.title}`
        : patch.titlePrefix,
    },
  };
}

/* ------------------------------------------------------------ the six presets */

const typewriter: ElementPreset = {
  id: "typewriter",
  label: "Typewriter reveal",
  description: "Types the code out character by character, with a caret at the head.",
  scope: "element",
  appliesTo: ["code"],
  apply: (element, context) => {
    if (element.type !== "code") return element;

    const available = life(element, context);
    const duration = clamp(typewriterFrames(element.content.code, context.fps), 10, available);

    return {
      ...element,
      content: { ...element.content, revealUnit: "character", showCaret: true },
      animations: [revealParts(duration)],
    };
  },
};

const lineByLine: ElementPreset = {
  id: "line-by-line",
  label: "Line-by-line reveal",
  description: "Fades the panel in, then brings the code in one line at a time.",
  scope: "element",
  appliesTo: ["code"],
  apply: (element, context) => {
    if (element.type !== "code") return element;

    const lineCount = codeLines(element.content.code).length;
    const available = life(element, context);
    const perLine = Math.max(2, Math.round(context.fps * 0.28));
    const duration = clamp(lineCount * perLine, context.fps, available);

    return {
      ...element,
      content: { ...element.content, revealUnit: "line", showCaret: false },
      animations: [
        fadeIn(Math.min(Math.round(context.fps * 0.3), available)),
        revealParts(duration, duration / Math.max(1, lineCount)),
      ],
    };
  },
};

const highlightAndExplain: ElementPreset = {
  id: "highlight-explain",
  label: "Highlight and explain",
  description: "Dims the panel down to the lines that matter so a caption can land.",
  scope: "element",
  appliesTo: ["code"],
  apply: (element, context) => {
    if (element.type !== "code") return element;

    const lineCount = codeLines(element.content.code).length;
    const chosen = element.content.highlightedLines;
    const range =
      chosen.length > 0
        ? { fromPart: Math.min(...chosen), toPart: Math.max(...chosen) }
        : middleRange(lineCount);

    const available = life(element, context);
    const settle = Math.round(context.fps * 0.4);

    return {
      ...element,
      animations: [
        fadeIn(Math.min(settle, available)),
        focusRange({
          ...range,
          offsetInFrames: Math.min(Math.round(available * 0.2), Math.max(0, available - 1)),
          durationInFrames: Math.min(settle, available),
          dim: 0.18,
          accent: context.theme.accent,
        }),
      ],
    };
  },
};

const walkthrough: ElementPreset = {
  id: "walkthrough",
  label: "Code walkthrough",
  description: "Reveals the code, then steps the focus down it in groups of lines.",
  scope: "element",
  appliesTo: ["code"],
  apply: (element, context) => {
    if (element.type !== "code") return element;

    const lineCount = codeLines(element.content.code).length;
    const available = life(element, context);

    const steps = Math.max(1, Math.min(4, lineCount));
    const group = Math.ceil(lineCount / steps);

    const revealLength = clamp(
      lineCount * Math.max(2, Math.round(context.fps * 0.16)),
      1,
      Math.max(1, Math.floor(available * 0.35)),
    );
    const perStep = Math.max(1, Math.floor((available - revealLength) / steps));

    const stepFocus = Array.from({ length: steps }, (_, index) =>
      focusRange({
        offsetInFrames: revealLength + index * perStep,
        durationInFrames: Math.min(Math.max(2, Math.round(context.fps * 0.25)), perStep),
        fromPart: index * group + 1,
        toPart: Math.min(lineCount, (index + 1) * group),
        dim: 0.2,
        accent: context.theme.accent,
      }),
    );

    return {
      ...element,
      content: { ...element.content, revealUnit: "line", showCaret: false },
      animations: [revealParts(revealLength, revealLength / Math.max(1, lineCount)), ...stepFocus],
    };
  },
};

const beforeAndAfter: ScenePreset = {
  id: "before-after",
  label: "Before and after",
  description: "Splits the panel into two, side by side, with the second arriving later.",
  scope: "scene",
  appliesTo: ["code"],
  apply: (element, elements, context) => {
    if (element.type !== "code") return elements;

    const { canvas } = context;
    const gutter = Math.round(canvas.width * 0.04);
    const width = Math.round((canvas.width - gutter * 3) / 2);
    const height = Math.round(canvas.height * 0.62);
    const y = Math.round((canvas.height - height) / 2);

    const settle = Math.max(1, Math.round(context.fps * 0.4));
    const arrive = Math.max(1, Math.round(context.sceneDurationInFrames * 0.3));
    const travel = Math.round(canvas.width * 0.04);

    const before = codePanel(element, {
      name: "Before",
      titlePrefix: "Before",
      rect: { x: gutter, y, width, height },
      from: 0,
      durationInFrames: null,
      animations: [fadeIn(settle), slideFrom("left", settle, travel)],
    });

    const after = codePanel(element, {
      name: "After",
      titlePrefix: "After",
      rect: { x: gutter * 2 + width, y, width, height },
      from: arrive,
      durationInFrames: null,
      animations: [fadeIn(settle), slideFrom("right", settle, travel)],
    });

    // The original is consumed by the pair rather than left behind as a third
    // panel nobody can see.
    return [...elements.filter((item) => item.id !== element.id), before, after];
  },
};

const sequentialTransformation: ScenePreset = {
  id: "sequential-transformation",
  label: "Sequential transformation",
  description: "Stacks two stages in the same spot and cross-fades from one to the next.",
  scope: "scene",
  appliesTo: ["code"],
  apply: (element, elements, context) => {
    if (element.type !== "code") return elements;

    const total = context.sceneDurationInFrames;
    const mid = Math.max(2, Math.floor(total / 2));
    // The two fades share one window, so the panels swap without a flash of
    // background between them.
    const crossfade = clamp(Math.round(total * 0.12), 1, mid);

    const first = codePanel(element, {
      name: "Step 1",
      titlePrefix: "Step 1",
      from: 0,
      durationInFrames: mid + crossfade,
      animations: [fadeIn(crossfade), fadeOut(crossfade * 2)],
    });

    const second = codePanel(element, {
      name: "Step 2",
      titlePrefix: "Step 2",
      from: mid - crossfade,
      durationInFrames: null,
      animations: [fadeIn(crossfade * 2)],
    });

    return [...elements.filter((item) => item.id !== element.id), first, second];
  },
};

export const ANIMATION_PRESETS: readonly Preset[] = [
  typewriter,
  lineByLine,
  highlightAndExplain,
  walkthrough,
  beforeAndAfter,
  sequentialTransformation,
];

export function findPreset(id: string): Preset | null {
  return ANIMATION_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The presets offered for a selected element, in the order they are listed. */
export function presetsFor(type: ElementType): Preset[] {
  return ANIMATION_PRESETS.filter((preset) => preset.appliesTo.includes(type));
}
