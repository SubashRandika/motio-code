import { describe, expect, it } from "vitest";

import { elementEndFrame, resolveElementState } from "@/core/animation";
import { codeLines } from "@/core/code";
import {
  ANIMATION_PRESETS,
  findPreset,
  presetsFor,
  type ElementPreset,
  type PresetContext,
  type ScenePreset,
} from "@/core/presets";
import {
  canvasConfigSchema,
  isCode,
  sceneElementSchema,
  themeConfigSchema,
  type CodeElement,
  type SceneElement,
} from "@/core/model";

import { makeCodeElement, makeTextElement } from "../fixtures";

const CANVAS = canvasConfigSchema.parse({});
const SCENE_DURATION = 240;

const CONTEXT: PresetContext = {
  canvas: CANVAS,
  theme: themeConfigSchema.parse({}),
  sceneDurationInFrames: SCENE_DURATION,
  fps: CANVAS.fps,
};

const LONG_CODE = Array.from({ length: 12 }, (_, index) => `const value${index} = ${index};`).join(
  "\n",
);

function elementPreset(id: string): ElementPreset {
  const preset = findPreset(id);
  if (!preset || preset.scope !== "element") throw new Error(`no element preset ${id}`);
  return preset;
}

function scenePreset(id: string): ScenePreset {
  const preset = findPreset(id);
  if (!preset || preset.scope !== "scene") throw new Error(`no scene preset ${id}`);
  return preset;
}

/** Every preset has to leave the project storable. */
function expectValid(element: SceneElement) {
  const parsed = sceneElementSchema.safeParse(element);
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
}

describe("the preset catalogue", () => {
  it("offers the six the product promises", () => {
    expect(ANIMATION_PRESETS.map((preset) => preset.id)).toEqual([
      "typewriter",
      "line-by-line",
      "highlight-explain",
      "walkthrough",
      "before-after",
      "sequential-transformation",
    ]);
  });

  it("offers nothing for an element type it cannot help", () => {
    expect(presetsFor("text")).toEqual([]);
    expect(presetsFor("code")).toHaveLength(6);
  });

  it("has a label and a description for each, since a button shows both", () => {
    for (const preset of ANIMATION_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  it("produces a valid element for every element-scoped preset", () => {
    const element = makeCodeElement({ content: { code: LONG_CODE } });

    for (const preset of ANIMATION_PRESETS) {
      if (preset.scope !== "element") continue;
      expectValid(preset.apply(element, CONTEXT));
    }
  });

  it("fits every animation inside the element's time on screen", () => {
    const element = makeCodeElement({ content: { code: LONG_CODE } });
    const life = elementEndFrame(element, SCENE_DURATION) - element.from;

    for (const preset of ANIMATION_PRESETS) {
      if (preset.scope !== "element") continue;

      for (const animation of preset.apply(element, CONTEXT).animations) {
        expect(
          animation.offsetInFrames + animation.durationInFrames,
          `${preset.id}/${animation.type}`,
        ).toBeLessThanOrEqual(life);
      }
    }
  });

  it("leaves a non-code element untouched if it is somehow asked", () => {
    const text = makeTextElement();
    expect(elementPreset("typewriter").apply(text, CONTEXT)).toBe(text);
  });
});

describe("typewriter reveal", () => {
  const applied = elementPreset("typewriter").apply(
    makeCodeElement({ content: { code: LONG_CODE } }),
    CONTEXT,
  ) as CodeElement;

  it("switches the panel to counting characters and shows the caret", () => {
    expect(applied.content.revealUnit).toBe("character");
    expect(applied.content.showCaret).toBe(true);
  });

  it("reveals linearly, because easing would make typing lurch", () => {
    expect(applied.animations).toHaveLength(1);
    expect(applied.animations[0]).toMatchObject({ type: "reveal", easing: "linear" });
  });

  it("is still typing partway through and finished by the end", () => {
    const duration = applied.animations[0].durationInFrames;

    expect(resolveElementState(applied, Math.floor(duration / 2), SCENE_DURATION).revealProgress)
      .toBeLessThan(1);
    expect(resolveElementState(applied, duration, SCENE_DURATION).revealProgress).toBe(1);
  });

  it("never outlasts the scene, however long the code is", () => {
    const huge = makeCodeElement({ content: { code: "x".repeat(20000) } });
    const result = elementPreset("typewriter").apply(huge, CONTEXT);

    expect(result.animations[0].durationInFrames).toBeLessThanOrEqual(SCENE_DURATION);
  });
});

describe("line-by-line reveal", () => {
  const applied = elementPreset("line-by-line").apply(
    makeCodeElement({ content: { code: LONG_CODE } }),
    CONTEXT,
  ) as CodeElement;

  it("counts lines, not characters", () => {
    expect(applied.content.revealUnit).toBe("line");
    expect(applied.content.showCaret).toBe(false);
  });

  it("fades the panel in before the code arrives", () => {
    expect(applied.animations.map((animation) => animation.type)).toEqual(["fade", "reveal"]);
  });

  it("staggers roughly one line per step", () => {
    const reveal = applied.animations[1];
    if (reveal.type !== "reveal") throw new Error("expected a reveal");

    const perLine = reveal.durationInFrames / codeLines(LONG_CODE).length;
    expect(reveal.staggerInFrames).toBeCloseTo(Math.round(perLine), 0);
  });
});

describe("highlight and explain", () => {
  it("focuses the lines the user already marked", () => {
    const element = makeCodeElement({
      content: { code: LONG_CODE, highlightedLines: [4, 5, 6] },
    });
    const applied = elementPreset("highlight-explain").apply(element, CONTEXT);
    const focus = applied.animations.find((animation) => animation.type === "focus");

    expect(focus).toMatchObject({ fromPart: 4, toPart: 6 });
  });

  it("picks a middle range when nothing is marked, rather than line 1", () => {
    const applied = elementPreset("highlight-explain").apply(
      makeCodeElement({ content: { code: LONG_CODE } }),
      CONTEXT,
    );
    const focus = applied.animations.find((animation) => animation.type === "focus");
    if (focus?.type !== "focus") throw new Error("expected a focus");

    expect(focus.fromPart).toBeGreaterThan(1);
    expect(focus.toPart).toBeLessThanOrEqual(codeLines(LONG_CODE).length);
  });

  it("does not reveal the code, because the point is that it is already there", () => {
    const applied = elementPreset("highlight-explain").apply(
      makeCodeElement({ content: { code: LONG_CODE } }),
      CONTEXT,
    );

    expect(applied.animations.some((animation) => animation.type === "reveal")).toBe(false);
  });

  it("copes with a two-line snippet", () => {
    const applied = elementPreset("highlight-explain").apply(
      makeCodeElement({ content: { code: "a\nb" } }),
      CONTEXT,
    );

    expectValid(applied);
    expect(applied.animations.find((animation) => animation.type === "focus")).toMatchObject({
      fromPart: 1,
      toPart: 2,
    });
  });
});

describe("code walkthrough", () => {
  const applied = elementPreset("walkthrough").apply(
    makeCodeElement({ content: { code: LONG_CODE } }),
    CONTEXT,
  );
  const steps = applied.animations.filter((animation) => animation.type === "focus");

  it("reveals first, then steps", () => {
    expect(applied.animations[0].type).toBe("reveal");
    expect(steps.length).toBeGreaterThan(1);
  });

  it("starts each step after the previous one", () => {
    const offsets = steps.map((step) => step.offsetInFrames);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it("starts the first step only once the reveal is done", () => {
    const reveal = applied.animations[0];
    expect(steps[0].offsetInFrames).toBeGreaterThanOrEqual(reveal.durationInFrames);
  });

  it("covers every line across the steps, leaving none unvisited", () => {
    const lineCount = codeLines(LONG_CODE).length;
    const visited = new Set<number>();

    for (const step of steps) {
      if (step.type !== "focus") continue;
      for (let line = step.fromPart; line <= step.toPart; line += 1) visited.add(line);
    }

    expect(visited.size).toBe(lineCount);
  });

  it("degrades to a single step on a one-line snippet", () => {
    const tiny = elementPreset("walkthrough").apply(
      makeCodeElement({ content: { code: "return 1;" } }),
      CONTEXT,
    );

    expectValid(tiny);
    expect(tiny.animations.filter((animation) => animation.type === "focus")).toHaveLength(1);
  });

  it("hands over between steps as the frames advance", () => {
    const first = steps[0];
    const second = steps[1];
    if (first.type !== "focus" || second.type !== "focus") throw new Error("expected focuses");

    expect(resolveElementState(applied, first.offsetInFrames + 1, SCENE_DURATION).focus).toMatchObject(
      { fromPart: first.fromPart },
    );
    expect(
      resolveElementState(applied, second.offsetInFrames + 1, SCENE_DURATION).focus,
    ).toMatchObject({ fromPart: second.fromPart });
  });
});

describe("before and after", () => {
  const original = makeCodeElement({ content: { code: LONG_CODE } });
  const other = makeTextElement({ id: "el_caption", layer: 1 });
  const result = scenePreset("before-after").apply(original, [original, other], CONTEXT);
  const panels = result.filter(isCode);

  it("replaces the panel with two, rather than leaving a third behind", () => {
    expect(panels).toHaveLength(2);
    expect(result.some((element) => element.id === original.id)).toBe(false);
  });

  it("keeps everything that was not the panel", () => {
    expect(result.some((element) => element.id === "el_caption")).toBe(true);
  });

  it("puts them side by side without overlapping", () => {
    const [left, right] = panels;
    expect(left.rect.x + left.rect.width).toBeLessThan(right.rect.x);
    expect(left.rect.y).toBe(right.rect.y);
  });

  it("keeps both inside the canvas", () => {
    for (const panel of panels) {
      expect(panel.rect.x).toBeGreaterThanOrEqual(0);
      expect(panel.rect.x + panel.rect.width).toBeLessThanOrEqual(CANVAS.width);
      expect(panel.rect.y + panel.rect.height).toBeLessThanOrEqual(CANVAS.height);
    }
  });

  it("labels them in the window bar rather than adding text elements", () => {
    expect(panels[0].content.title).toContain("Before");
    expect(panels[1].content.title).toContain("After");
    expect(result.filter((element) => element.type === "text")).toHaveLength(1);
  });

  it("keeps the original title alongside the label", () => {
    expect(panels[0].content.title).toContain("example.ts");
  });

  it("brings the second one in later", () => {
    expect(panels[0].from).toBe(0);
    expect(panels[1].from).toBeGreaterThan(0);
    expect(panels[1].from).toBeLessThan(SCENE_DURATION);
  });

  it("gives each panel a fresh id", () => {
    expect(panels[0].id).not.toBe(panels[1].id);
    expect(panels[0].id).not.toBe(original.id);
  });

  it("produces valid elements", () => {
    result.forEach(expectValid);
  });
});

describe("sequential transformation", () => {
  const original = makeCodeElement({ content: { code: LONG_CODE } });
  const result = scenePreset("sequential-transformation").apply(original, [original], CONTEXT);
  const [first, second] = result.filter(isCode);

  it("stacks the stages in the same place, so the code reads as changing in place", () => {
    expect(second.rect).toEqual(first.rect);
  });

  it("overlaps them in time, so nothing flashes between the stages", () => {
    const firstEnd = elementEndFrame(first, SCENE_DURATION);
    expect(second.from).toBeLessThan(firstEnd);
  });

  it("cross-fades over exactly the shared window", () => {
    const exit = first.animations.find((animation) => animation.trigger === "exit");
    const enter = second.animations.find((animation) => animation.trigger === "enter");
    if (!exit || !enter) throw new Error("expected an exit and an enter fade");

    const firstEnd = elementEndFrame(first, SCENE_DURATION);
    expect(firstEnd - exit.durationInFrames).toBe(second.from);
    expect(enter.durationInFrames).toBe(exit.durationInFrames);
  });

  it("is fully opaque on the first stage before the swap and the second after", () => {
    const early = resolveElementState(first, 2, SCENE_DURATION);
    const late = resolveElementState(second, SCENE_DURATION - 1, SCENE_DURATION);

    expect(early.visible).toBe(true);
    expect(late.opacity).toBeCloseTo(1, 5);
  });

  it("runs the second stage to the end of the scene", () => {
    expect(second.durationInFrames).toBeNull();
  });

  it("numbers the stages in the window bar", () => {
    expect(first.content.title).toContain("Step 1");
    expect(second.content.title).toContain("Step 2");
  });

  it("produces valid elements", () => {
    result.forEach(expectValid);
  });
});
