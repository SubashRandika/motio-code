"use client";

import { useEffect, useState } from "react";

import {
  highlightCode,
  highlightedOrPlain,
  peekHighlightedCode,
  type CodeThemeName,
  type HighlightedCode,
} from "@/core/code";
import type { CodeLanguage } from "@/core/model";

/**
 * Tokens for a code panel.
 *
 * The cache lookup is synchronous, so a panel whose source has not changed
 * re-renders at the frame rate without touching the highlighter. The first time
 * a source appears the hook returns uncoloured lines and loads the highlighter
 * in the background; when it resolves, one re-render swaps the tokens in.
 *
 * Highlighting deliberately never blocks a paint. A dropped frame while
 * scrubbing would be worse than a few frames of plain text, and the preview
 * must keep the same timing the renderer will.
 */
export function useCodeTokens(
  code: string,
  language: CodeLanguage,
  codeTheme: CodeThemeName,
  fallbackColor: string,
): HighlightedCode {
  // Bumped when a highlight resolves, to pull the new tokens out of the cache.
  const [, setVersion] = useState(0);
  const ready = peekHighlightedCode(code, language, codeTheme) !== null;

  useEffect(() => {
    if (peekHighlightedCode(code, language, codeTheme)) return;

    let live = true;
    highlightCode(code, language, codeTheme)
      .then(() => {
        if (live) setVersion((version) => version + 1);
      })
      .catch(() => {
        // Plain lines are a complete fallback, so a failed load is not worth
        // interrupting the editor for.
      });

    return () => {
      live = false;
    };
  }, [code, language, codeTheme, ready]);

  return highlightedOrPlain(code, language, codeTheme, fallbackColor);
}
