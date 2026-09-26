import type { CodeRevealUnit } from "@/core/model";

/**
 * Syntax tokens, and the arithmetic that reveals them over time.
 *
 * Tokenising is expensive and has nothing to do with the frame being drawn, so
 * it happens once per unique (code, language, theme) and is cached. Everything
 * in this file is a pure function of the tokens plus a 0-1 progress value, so a
 * frame can be drawn from it without touching a highlighter, the DOM, or the
 * clock.
 */

/** One run of characters that share a colour. */
export interface CodeToken {
  text: string;
  color: string;
  italic: boolean;
  bold: boolean;
}

export type CodeLineTokens = CodeToken[];

export interface HighlightedCode {
  lines: CodeLineTokens[];
  /** The theme's default foreground, for anything the grammar left uncoloured. */
  foreground: string;
}

export function codeLines(code: string): string[] {
  return code.split("\n");
}

/**
 * Unhighlighted tokens: one per line, all in the same colour.
 *
 * This is what a renderer draws before the highlighter has loaded, and what it
 * falls back to if loading fails. Because it has the same shape as a
 * highlighted line, nothing downstream has to know which it is looking at.
 */
export function plainCode(code: string, foreground: string): HighlightedCode {
  return {
    lines: codeLines(code).map((line) => [
      { text: line, color: foreground, italic: false, bold: false },
    ]),
    foreground,
  };
}

/** The visible prefix of a line, cut to `characters` and keeping token colours. */
export function sliceLineTokens(tokens: CodeLineTokens, characters: number): CodeLineTokens {
  if (characters <= 0) return [];

  const out: CodeLineTokens = [];
  let budget = characters;

  for (const token of tokens) {
    if (budget <= 0) break;

    if (token.text.length <= budget) {
      out.push(token);
      budget -= token.text.length;
    } else {
      out.push({ ...token, text: token.text.slice(0, budget) });
      budget = 0;
    }
  }

  return out;
}

export function lineLength(tokens: CodeLineTokens): number {
  return tokens.reduce((total, token) => total + token.text.length, 0);
}

/** Where a typing caret sits: a 0-based line and the column it has reached. */
export interface CodeCaret {
  line: number;
  column: number;
}

export interface RevealedCodeLine {
  tokens: CodeLineTokens;
  /** 0-1. A line that has not arrived yet still occupies its row, so the
   *  panel never reflows as the reveal runs. */
  opacity: number;
}

export interface RevealedCode {
  lines: RevealedCodeLine[];
  /** `null` once everything is on screen. */
  caret: CodeCaret | null;
}

/**
 * Applies a 0-1 reveal progress to a set of tokenised lines.
 *
 * `line` fades each line in as a whole -- the line-by-line reveal.
 * `character` types the code out, truncating one line mid-flight -- the
 * typewriter. A newline counts as a character so a blank line still takes time,
 * which is what stops a gap in the source from being skipped instantly.
 */
export function revealCode(
  lines: CodeLineTokens[],
  unit: CodeRevealUnit,
  progress: number,
): RevealedCode {
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;

  if (lines.length === 0) return { lines: [], caret: null };
  if (clamped >= 1) {
    return { lines: lines.map((tokens) => ({ tokens, opacity: 1 })), caret: null };
  }

  if (unit === "line") {
    const exact = clamped * lines.length;
    const shown = Math.floor(exact);

    return {
      lines: lines.map((tokens, index) => ({
        tokens,
        opacity: index < shown ? 1 : index === shown ? exact - shown : 0,
      })),
      caret: { line: Math.min(shown, lines.length - 1), column: 0 },
    };
  }

  // Character unit: walk the lines spending a single budget.
  const lengths = lines.map(lineLength);
  const total = lengths.reduce((sum, length) => sum + length + 1, 0);
  let budget = Math.floor(clamped * total);
  let caret: CodeCaret | null = null;
  const revealed: RevealedCodeLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const length = lengths[index];

    if (caret === null && budget < length + 1) {
      caret = { line: index, column: Math.min(budget, length) };
    }

    if (budget >= length + 1) {
      budget -= length + 1;
      revealed.push({ tokens: lines[index], opacity: 1 });
      continue;
    }

    revealed.push({ tokens: sliceLineTokens(lines[index], budget), opacity: 1 });
    budget = 0;
  }

  return { lines: revealed, caret };
}

/**
 * How many frames a typewriter needs to look like typing rather than a smear.
 * Used by the presets so a two-line snippet and a thirty-line one both read at
 * a sensible speed.
 */
export function typewriterFrames(code: string, fps: number): number {
  const charactersPerSecond = 28;
  return Math.max(fps, Math.round((code.length / charactersPerSecond) * fps));
}
