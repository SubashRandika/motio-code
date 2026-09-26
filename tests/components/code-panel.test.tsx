import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { highlightCode } from "@/core/code";
import { createId, themeConfigSchema, type Animation } from "@/core/model";
import { ElementView } from "@/features/editor/element-view";

import { makeCodeElement } from "../fixtures";

const THEME = themeConfigSchema.parse({});
const SCENE = 120;
const CODE = ["const a = 1;", "const b = 2;", "return a + b;"].join("\n");

/**
 * Tokenising is asynchronous the first time a source appears. Warming the cache
 * up front keeps the tests about rendering rather than about the load, and it is
 * also the state a real editor is in for all but the first frame.
 */
beforeAll(async () => {
  await highlightCode(CODE, "typescript", "console-dark");
});

function paint(
  element: Parameters<typeof ElementView>[0]["element"],
  frame: number,
): HTMLElement {
  const { container } = render(
    <ElementView
      element={element}
      frame={frame}
      sceneDurationInFrames={SCENE}
      theme={THEME}
    />,
  );
  return container;
}

function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("code > div"));
}

function reveal(durationInFrames: number): Animation {
  return {
    id: createId("an"),
    type: "reveal",
    trigger: "enter",
    offsetInFrames: 0,
    durationInFrames,
    easing: "linear",
    staggerInFrames: 0,
  };
}

function focus(overrides: Partial<Extract<Animation, { type: "focus" }>>): Animation {
  return {
    id: createId("an"),
    type: "focus",
    trigger: "at",
    offsetInFrames: 0,
    durationInFrames: 1,
    easing: "linear",
    fromPart: 1,
    toPart: 1,
    dim: 0.2,
    accent: "#F2A63B",
    ...overrides,
  };
}

describe("a code panel", () => {
  it("draws one row per source line", () => {
    const container = paint(makeCodeElement({ content: { code: CODE } }), 0);
    expect(rows(container)).toHaveLength(3);
  });

  it("numbers the lines from one", () => {
    const container = paint(makeCodeElement({ content: { code: CODE } }), 0);
    const numbers = rows(container).map((row) => row.firstElementChild?.textContent);

    expect(numbers).toEqual(["1", "2", "3"]);
  });

  it("omits the gutter when line numbers are off", () => {
    const container = paint(
      makeCodeElement({ content: { code: CODE, showLineNumbers: false } }),
      0,
    );

    expect(rows(container)[0].textContent).toBe("const a = 1;");
  });

  it("shows the title in the window bar, falling back to the language", () => {
    const titled = paint(makeCodeElement({ content: { code: CODE, title: "auth.ts" } }), 0);
    expect(titled.textContent).toContain("auth.ts");

    const untitled = paint(makeCodeElement({ content: { code: CODE, title: "" } }), 0);
    expect(untitled.textContent).toContain("typescript");
  });

  it("colours a keyword differently from the default foreground", () => {
    const container = paint(makeCodeElement({ content: { code: CODE } }), 0);
    const colours = new Set(
      Array.from(container.querySelectorAll("code span")).map(
        (span) => (span as HTMLElement).style.color,
      ),
    );

    // More than one colour means the tokens, not the fallback, are on screen.
    expect(colours.size).toBeGreaterThan(1);
  });

  it("shows the code immediately in plain text while the highlighter loads", async () => {
    const fresh = "const neverSeenBefore = true;";
    const container = paint(makeCodeElement({ content: { code: fresh } }), 0);

    expect(container.textContent).toContain(fresh);

    // And swaps in the tokens without the text changing.
    await waitFor(() => {
      expect(container.querySelectorAll("code span").length).toBeGreaterThan(2);
    });
    expect(container.textContent).toContain(fresh);
  });
});

describe("a line-by-line reveal", () => {
  const element = makeCodeElement({
    content: { code: CODE, revealUnit: "line" },
    animations: [reveal(30)],
  });

  it("hides the later lines at the start but keeps their rows", () => {
    const container = paint(element, 0);
    const opacities = rows(container).map((row) => row.style.opacity);

    expect(rows(container)).toHaveLength(3);
    expect(opacities[0]).toBe("0");
    expect(opacities[2]).toBe("0");
  });

  it("brings the lines in one at a time", () => {
    const container = paint(element, 15);
    const opacities = rows(container).map((row) => Number(row.style.opacity));

    expect(opacities[0]).toBe(1);
    expect(opacities[2]).toBe(0);
  });

  it("has everything on screen when it ends", () => {
    const container = paint(element, 30);
    expect(rows(container).map((row) => Number(row.style.opacity))).toEqual([1, 1, 1]);
  });

  it("keeps the full text of an unrevealed line, so nothing reflows", () => {
    const container = paint(element, 0);
    expect(rows(container)[2].textContent).toContain("return a + b;");
  });
});

describe("a typewriter reveal", () => {
  const element = makeCodeElement({
    content: { code: CODE, revealUnit: "character", showCaret: true },
    animations: [reveal(40)],
  });

  it("truncates the line being typed rather than fading it", () => {
    const container = paint(element, 10);
    const text = rows(container)[0].textContent ?? "";

    expect(text.length).toBeGreaterThan(1);
    expect(text).not.toContain("const a = 1;");
  });

  it("has typed the whole source by the end", () => {
    const container = paint(element, 40);
    expect(container.textContent).toContain("return a + b;");
  });

  it("draws a caret while typing and removes it when done", () => {
    const typing = paint(element, 10);
    const done = paint(element, 40);

    expect(typing.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThan(0);
    expect(rowsHaveCaret(typing)).toBe(true);
    expect(rowsHaveCaret(done)).toBe(false);
  });

  it("blinks the caret from the frame number, not from a CSS animation", () => {
    // The blink has an eight-frame period, so 4 and 12 fall in opposite halves.
    const on = caretOpacity(paint(element, 4));
    const off = caretOpacity(paint(element, 12));

    expect(on).not.toBe(off);
    // Seeking back to the same frame gives the same caret.
    expect(caretOpacity(paint(element, 4))).toBe(on);
    expect(caretOpacity(paint(element, 20))).toBe(on);
  });

  it("does not draw a caret when the panel asks for none", () => {
    const withoutCaret = makeCodeElement({
      content: { code: CODE, revealUnit: "character", showCaret: false },
      animations: [reveal(40)],
    });

    expect(rowsHaveCaret(paint(withoutCaret, 10))).toBe(false);
  });
});

describe("focus on a code panel", () => {
  it("dims the lines outside the range and leaves those inside alone", () => {
    const element = makeCodeElement({
      content: { code: CODE },
      animations: [focus({ fromPart: 2, toPart: 2, dim: 0.2 })],
    });

    const opacities = rows(paint(element, 10)).map((row) => Number(row.style.opacity));

    expect(opacities[0]).toBeCloseTo(0.2, 5);
    expect(opacities[1]).toBe(1);
    expect(opacities[2]).toBeCloseTo(0.2, 5);
  });

  it("tints the focused line", () => {
    const element = makeCodeElement({
      content: { code: CODE },
      animations: [focus({ fromPart: 3, toPart: 3 })],
    });

    const painted = rows(paint(element, 10));
    expect(painted[2].style.backgroundColor).not.toBe("");
    expect(painted[0].style.backgroundColor).toBe("");
  });

  it("leaves every line alone before the focus begins", () => {
    const element = makeCodeElement({
      content: { code: CODE },
      animations: [focus({ fromPart: 2, toPart: 2, offsetInFrames: 60 })],
    });

    expect(rows(paint(element, 10)).map((row) => Number(row.style.opacity))).toEqual([1, 1, 1]);
  });
});

describe("statically highlighted lines", () => {
  it("washes the marked line without any animation", () => {
    const element = makeCodeElement({ content: { code: CODE, highlightedLines: [2] } });
    const painted = rows(paint(element, 0));

    expect(painted[1].style.backgroundColor).not.toBe("");
    expect(painted[0].style.backgroundColor).toBe("");
  });
});

/** The caret is the only zero-width decorative span inside a row. */
function rowsHaveCaret(container: HTMLElement): boolean {
  return Array.from(container.querySelectorAll("code span[aria-hidden='true']")).some(
    (span) => (span as HTMLElement).style.backgroundColor !== "",
  );
}

function caretOpacity(container: HTMLElement): string {
  const caret = Array.from(container.querySelectorAll("code span[aria-hidden='true']")).find(
    (span) => (span as HTMLElement).style.backgroundColor !== "",
  );

  return (caret as HTMLElement | undefined)?.style.opacity ?? "";
}
