import { describe, expect, it } from "vitest";

import {
  codeLines,
  lineLength,
  plainCode,
  revealCode,
  sliceLineTokens,
  typewriterFrames,
  type CodeLineTokens,
} from "@/core/code";

function tokens(...parts: [string, string][]): CodeLineTokens {
  return parts.map(([text, color]) => ({ text, color, italic: false, bold: false }));
}

const LINES: CodeLineTokens[] = [
  tokens(["const", "#a"], [" a = 1;", "#b"]), // 12 characters
  tokens(["return", "#a"], [" a;", "#b"]), // 9 characters
];

describe("plainCode", () => {
  it("gives one token per line so the shape matches a highlighted result", () => {
    const plain = plainCode("a\nb\n", "#fff");

    expect(plain.lines).toHaveLength(3);
    expect(plain.lines[0]).toEqual([{ text: "a", color: "#fff", italic: false, bold: false }]);
    expect(plain.lines[2]).toEqual([{ text: "", color: "#fff", italic: false, bold: false }]);
  });

  it("keeps a trailing blank line, because line numbers are counted from it", () => {
    expect(codeLines("a\n")).toHaveLength(2);
  });
});

describe("sliceLineTokens", () => {
  it("cuts inside a token and keeps that token's colour", () => {
    const sliced = sliceLineTokens(LINES[0], 8);

    expect(sliced).toHaveLength(2);
    expect(sliced[0].text).toBe("const");
    expect(sliced[1]).toEqual({ text: " a ", color: "#b", italic: false, bold: false });
  });

  it("returns nothing at zero and everything past the end", () => {
    expect(sliceLineTokens(LINES[0], 0)).toEqual([]);
    expect(lineLength(sliceLineTokens(LINES[0], 500))).toBe(12);
  });
});

describe("revealCode by line", () => {
  it("shows nothing at the start and everything at the end", () => {
    expect(revealCode(LINES, "line", 0).lines.map((line) => line.opacity)).toEqual([0, 0]);
    expect(revealCode(LINES, "line", 1).lines.map((line) => line.opacity)).toEqual([1, 1]);
  });

  it("fades the line in flight and leaves the rest at zero", () => {
    const halfway = revealCode(LINES, "line", 0.75);

    expect(halfway.lines[0].opacity).toBe(1);
    expect(halfway.lines[1].opacity).toBeCloseTo(0.5, 5);
  });

  it("keeps every line's tokens, so the panel never reflows", () => {
    const early = revealCode(LINES, "line", 0.1);

    expect(early.lines).toHaveLength(2);
    expect(lineLength(early.lines[1].tokens)).toBe(9);
  });

  it("drops the caret once the reveal is finished", () => {
    expect(revealCode(LINES, "line", 0.4)?.caret).toEqual({ line: 0, column: 0 });
    expect(revealCode(LINES, "line", 1).caret).toBeNull();
  });
});

describe("revealCode by character", () => {
  // 12 + 1 newline + 9 + 1 = 23 characters of budget.
  it("types across the line break", () => {
    const first = revealCode(LINES, "character", 8 / 23);

    expect(lineLength(first.lines[0].tokens)).toBe(8);
    expect(first.lines[1].tokens).toEqual([]);
    expect(first.caret).toEqual({ line: 0, column: 8 });
  });

  it("finishes a line before starting the next", () => {
    const second = revealCode(LINES, "character", 16 / 23);

    expect(lineLength(second.lines[0].tokens)).toBe(12);
    expect(lineLength(second.lines[1].tokens)).toBe(3);
    expect(second.caret).toEqual({ line: 1, column: 3 });
  });

  it("holds every line at full opacity, because truncation is what hides text", () => {
    const partway = revealCode(LINES, "character", 0.3);
    expect(partway.lines.every((line) => line.opacity === 1)).toBe(true);
  });

  it("spends a frame on a blank line rather than skipping it", () => {
    const withGap: CodeLineTokens[] = [tokens(["ab", "#a"]), [], tokens(["cd", "#a"])];

    // Budget is (2+1) + (0+1) + (2+1) = 7. Four characters finishes the first
    // line and spends one on the blank one, leaving nothing for the third.
    const atFour = revealCode(withGap, "character", 4 / 7);
    expect(lineLength(atFour.lines[0].tokens)).toBe(2);
    expect(lineLength(atFour.lines[2].tokens)).toBe(0);
    expect(atFour.caret).toEqual({ line: 2, column: 0 });

    // Only the fifth reaches the third line, which is the frame the blank line
    // bought.
    expect(lineLength(revealCode(withGap, "character", 5 / 7).lines[2].tokens)).toBe(1);
  });

  it("clamps out-of-range progress instead of producing negative slices", () => {
    expect(revealCode(LINES, "character", -2).caret).toEqual({ line: 0, column: 0 });
    expect(revealCode(LINES, "character", 4).caret).toBeNull();
  });
});

describe("typewriterFrames", () => {
  it("never goes below a second, so a one-word snippet still reads as typing", () => {
    expect(typewriterFrames("x", 30)).toBe(30);
  });

  it("scales with the amount of code", () => {
    const short = typewriterFrames("a".repeat(100), 30);
    const long = typewriterFrames("a".repeat(400), 30);

    expect(long).toBeGreaterThan(short);
    expect(long / short).toBeCloseTo(4, 1);
  });
});
