import type { CodeLanguage, ThemeConfig } from "@/core/model";

import { plainCode, type CodeLineTokens, type HighlightedCode } from "./tokens";

/**
 * Syntax highlighting, kept off the frame path.
 *
 * Three decisions worth stating:
 *
 * 1. **Shiki's fine-grained bundle, not the full one.** Only the eight
 *    languages the product supports and the two themes it ships are loaded, and
 *    they arrive through a dynamic import, so nothing about highlighting is in
 *    the first bundle a user downloads.
 * 2. **The JavaScript regex engine, not the WebAssembly one.** It needs no
 *    `.wasm` asset, which means the same code path works in the browser, in a
 *    test runner and in a headless renderer with no bundler configuration.
 * 3. **A bounded cache keyed on the input.** Tokenising is a pure function of
 *    (code, language, theme), so a result can be reused for every frame of the
 *    animation and across re-renders. A frame never waits on a highlighter.
 */

/** The composition themes, mapped onto the Shiki themes that dress them. */
const SHIKI_THEMES: Record<ThemeConfig["codeTheme"], string> = {
  "console-dark": "vitesse-dark",
  "console-light": "vitesse-light",
};

export type CodeThemeName = ThemeConfig["codeTheme"];

interface Highlighter {
  codeToTokens: (
    code: string,
    options: { lang: string; theme: string },
  ) => {
    tokens: { content: string; color?: string; fontStyle?: number }[][];
    fg: string;
  };
}

/** Shiki's `FontStyle` bit flags. Italic is 1, bold 2, underline 4. */
const ITALIC = 1;
const BOLD = 2;

let loading: Promise<Highlighter> | null = null;

async function loadHighlighter(): Promise<Highlighter> {
  if (loading) return loading;

  loading = (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, langs, themes] =
      await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
        Promise.all([
          import("@shikijs/langs/typescript"),
          import("@shikijs/langs/javascript"),
          import("@shikijs/langs/python"),
          import("@shikijs/langs/csharp"),
          import("@shikijs/langs/java"),
          import("@shikijs/langs/sql"),
          import("@shikijs/langs/json"),
          import("@shikijs/langs/bash"),
        ]),
        Promise.all([
          import("@shikijs/themes/vitesse-dark"),
          import("@shikijs/themes/vitesse-light"),
        ]),
      ]);

    return (await createHighlighterCore({
      langs: langs.map((module) => module.default),
      themes: themes.map((module) => module.default),
      engine: createJavaScriptRegexEngine(),
    })) as unknown as Highlighter;
  })().catch((error) => {
    // A failed load must not poison every later attempt.
    loading = null;
    throw error;
  });

  return loading;
}

const CACHE_LIMIT = 120;
const cache = new Map<string, HighlightedCode>();

function cacheKey(code: string, language: CodeLanguage, theme: CodeThemeName): string {
  // \u0000 cannot appear in any of the three parts, so the key is unambiguous.
  return `${theme}\u0000${language}\u0000${code}`;
}

function remember(key: string, value: HighlightedCode): HighlightedCode {
  cache.set(key, value);

  // Map iterates in insertion order, so the first key is the oldest.
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }

  return value;
}

/**
 * An already-tokenised result, or `null`.
 *
 * Synchronous on purpose: a renderer asks for this while drawing and falls back
 * to plain text rather than suspending mid-frame.
 */
export function peekHighlightedCode(
  code: string,
  language: CodeLanguage,
  theme: CodeThemeName,
): HighlightedCode | null {
  return cache.get(cacheKey(code, language, theme)) ?? null;
}

/**
 * Tokenises the code, loading the highlighter the first time it is asked.
 *
 * Resolving also fills the cache, which is what makes the next `peek` a hit.
 */
export async function highlightCode(
  code: string,
  language: CodeLanguage,
  theme: CodeThemeName,
): Promise<HighlightedCode> {
  const key = cacheKey(code, language, theme);
  const cached = cache.get(key);
  if (cached) return cached;

  const highlighter = await loadHighlighter();
  const result = highlighter.codeToTokens(code, {
    lang: language,
    theme: SHIKI_THEMES[theme],
  });

  const lines: CodeLineTokens[] = result.tokens.map((line) =>
    line.map((token) => ({
      text: token.content,
      color: token.color ?? result.fg,
      italic: ((token.fontStyle ?? 0) & ITALIC) !== 0,
      bold: ((token.fontStyle ?? 0) & BOLD) !== 0,
    })),
  );

  // Shiki drops the trailing empty line that `split("\n")` keeps. Restoring it
  // matters: line numbers and reveal maths are derived from the source, and a
  // panel that renders one row short of its own line count looks broken.
  const expected = code.split("\n").length;
  while (lines.length < expected) {
    lines.push([{ text: "", color: result.fg, italic: false, bold: false }]);
  }

  return remember(key, { lines, foreground: result.fg });
}

/** Tokens if they are ready, otherwise uncoloured lines in the given colour. */
export function highlightedOrPlain(
  code: string,
  language: CodeLanguage,
  theme: CodeThemeName,
  foreground: string,
): HighlightedCode {
  return peekHighlightedCode(code, language, theme) ?? plainCode(code, foreground);
}

/** Test seam: drops the cache so a test can observe the pending state again. */
export function clearHighlightCache(): void {
  cache.clear();
}
