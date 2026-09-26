import { beforeEach, describe, expect, it } from "vitest";

import {
  clearHighlightCache,
  highlightCode,
  highlightedOrPlain,
  lineLength,
  peekHighlightedCode,
} from "@/core/code";

const SOURCE = `export function greet(name: string) {
  return \`Hello, \${name}\`;
}`;

beforeEach(() => {
  clearHighlightCache();
});

describe("highlightCode", () => {
  it("colours a keyword differently from an identifier", async () => {
    const result = await highlightCode(SOURCE, "typescript", "console-dark");
    const first = result.lines[0];

    const keyword = first.find((token) => token.text.trim() === "export");
    const name = first.find((token) => token.text.trim() === "greet");

    expect(keyword).toBeDefined();
    expect(name).toBeDefined();
    expect(keyword?.color).not.toBe(name?.color);
  });

  it("produces one entry per source line", async () => {
    const result = await highlightCode(SOURCE, "typescript", "console-dark");
    expect(result.lines).toHaveLength(SOURCE.split("\n").length);
  });

  it("keeps a trailing blank line that the highlighter would drop", async () => {
    // Line numbers and the reveal maths come from the source, so a panel that
    // renders one row short of its own line count would look broken.
    const result = await highlightCode("const a = 1;\n", "typescript", "console-dark");

    expect(result.lines).toHaveLength(2);
    expect(lineLength(result.lines[1])).toBe(0);
  });

  it("preserves every character of the source", async () => {
    const result = await highlightCode(SOURCE, "typescript", "console-dark");
    const rebuilt = result.lines
      .map((line) => line.map((token) => token.text).join(""))
      .join("\n");

    expect(rebuilt).toBe(SOURCE);
  });

  it("gives the same code different colours under different themes", async () => {
    const dark = await highlightCode(SOURCE, "typescript", "console-dark");
    const light = await highlightCode(SOURCE, "typescript", "console-light");

    expect(dark.foreground).not.toBe(light.foreground);
  });

  it("highlights every language the product offers", async () => {
    const samples = [
      ["python", "def greet(name):\n    return name"],
      ["csharp", "public class A { }"],
      ["java", "class A { }"],
      ["sql", "select 1 from t"],
      ["json", '{ "a": 1 }'],
      ["bash", "echo hi"],
      ["javascript", "const a = 1;"],
    ] as const;

    for (const [language, code] of samples) {
      const result = await highlightCode(code, language, "console-dark");
      expect(result.lines.length, language).toBeGreaterThan(0);
    }
  });
});

describe("the token cache", () => {
  it("is empty before the first highlight and a hit afterwards", async () => {
    expect(peekHighlightedCode(SOURCE, "typescript", "console-dark")).toBeNull();

    await highlightCode(SOURCE, "typescript", "console-dark");

    expect(peekHighlightedCode(SOURCE, "typescript", "console-dark")).not.toBeNull();
  });

  it("returns the identical object, so a re-render does no work", async () => {
    const first = await highlightCode(SOURCE, "typescript", "console-dark");
    const second = await highlightCode(SOURCE, "typescript", "console-dark");

    expect(second).toBe(first);
  });

  it("keys on the theme as well as the code", async () => {
    await highlightCode(SOURCE, "typescript", "console-dark");
    expect(peekHighlightedCode(SOURCE, "typescript", "console-light")).toBeNull();
  });

  it("keys on the language, because the same text tokenises differently", async () => {
    await highlightCode("select 1", "sql", "console-dark");
    expect(peekHighlightedCode("select 1", "python", "console-dark")).toBeNull();
  });
});

describe("highlightedOrPlain", () => {
  it("falls back to uncoloured lines rather than blocking a frame", () => {
    const plain = highlightedOrPlain("a\nb", "typescript", "console-dark", "#FFFFFF");

    expect(plain.lines).toHaveLength(2);
    expect(plain.lines[0][0].color).toBe("#FFFFFF");
  });

  it("uses the tokens once they are cached", async () => {
    await highlightCode("const a = 1;", "typescript", "console-dark");
    const ready = highlightedOrPlain("const a = 1;", "typescript", "console-dark", "#FFFFFF");

    expect(ready.lines[0].length).toBeGreaterThan(1);
  });
});
