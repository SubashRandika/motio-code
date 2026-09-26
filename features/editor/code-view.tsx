"use client";

import { resolveFocus, type ElementRenderState } from "@/core/animation";
import {
  lineLength,
  revealCode,
  type CodeLineTokens,
  type CodeToken,
  type RevealedCodeLine,
} from "@/core/code";
import type { CodeElement, ThemeConfig } from "@/core/model";

import { useCodeTokens } from "./use-code-tokens";

/**
 * A code panel at one frame.
 *
 * Tokens come from a cache keyed on the source, so the highlighter runs when
 * the code changes and never while scrubbing. Everything else -- which lines
 * are in, where the caret sits, which lines are dimmed -- is arithmetic on the
 * render state.
 */
export function CodeView({
  element,
  state,
  theme,
  frame,
}: {
  element: CodeElement;
  state: ElementRenderState;
  theme: ThemeConfig;
  frame: number;
}) {
  const { content } = element;
  const highlighted = useCodeTokens(content.code, content.language, theme.codeTheme, theme.text);
  const revealed = revealCode(highlighted.lines, content.revealUnit, state.revealProgress);

  const gutterWidth = `${String(highlighted.lines.length).length + 1}ch`;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {content.showWindowChrome ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderBottom: `1px solid ${theme.border}`,
            color: theme.muted,
            fontFamily: "var(--font-jetbrains)",
            fontSize: Math.max(10, content.fontSize * 0.66),
          }}
        >
          {content.title || content.language}
        </div>
      ) : null}

      <pre
        style={{
          margin: 0,
          padding: 12,
          overflow: "hidden",
          fontFamily: "var(--font-jetbrains)",
          fontSize: content.fontSize,
          lineHeight: content.lineHeight,
          color: highlighted.foreground,
        }}
      >
        <code>
          {revealed.lines.map((line, index) => (
            <CodeLine
              key={index}
              line={line}
              index={index}
              element={element}
              state={state}
              theme={theme}
              fullTokens={highlighted.lines[index] ?? []}
              caretColumn={
                content.showCaret && revealed.caret?.line === index ? revealed.caret.column : null
              }
              frame={frame}
              gutterWidth={gutterWidth}
            />
          ))}
        </code>
      </pre>
    </div>
  );
}

function CodeLine({
  line,
  index,
  element,
  state,
  theme,
  fullTokens,
  caretColumn,
  frame,
  gutterWidth,
}: {
  line: RevealedCodeLine;
  index: number;
  element: CodeElement;
  state: ElementRenderState;
  theme: ThemeConfig;
  fullTokens: CodeLineTokens;
  caretColumn: number | null;
  frame: number;
  gutterWidth: string;
}) {
  const lineNumber = index + 1;
  const focus = resolveFocus(state, lineNumber);

  // A statically highlighted line and a focused one use the same wash, so the
  // two ways of drawing attention never stack into an unreadable block.
  const pinned = element.content.highlightedLines.includes(lineNumber);
  const wash = focus.emphasis > 0 ? focus.emphasis : pinned ? 0.55 : 0;
  const washColor = focus.accent ?? theme.accent;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        opacity: line.opacity * focus.opacity,
        backgroundColor: wash > 0 ? withAlpha(washColor, wash * 0.22) : undefined,
      }}
    >
      {element.content.showLineNumbers ? (
        <span
          style={{
            width: gutterWidth,
            flexShrink: 0,
            textAlign: "right",
            marginRight: "1.5ch",
            color: theme.muted,
            userSelect: "none",
          }}
        >
          {lineNumber}
        </span>
      ) : null}

      <span style={{ whiteSpace: "pre" }}>
        {line.tokens.length === 0 && caretColumn === null ? " " : null}
        {line.tokens.map((token, tokenIndex) => (
          <Token key={tokenIndex} token={token} />
        ))}
        {caretColumn === null ? null : <Caret theme={theme} frame={frame} />}
        {/* The rest of the line keeps its width while it is still being typed,
            so nothing to the right of the panel shifts as the caret advances. */}
        {caretColumn === null ? null : (
          <span aria-hidden="true" style={{ visibility: "hidden" }}>
            {" ".repeat(Math.max(0, lineLength(fullTokens) - caretColumn))}
          </span>
        )}
      </span>
    </div>
  );
}

function Token({ token }: { token: CodeToken }) {
  return (
    <span
      style={{
        color: token.color,
        fontStyle: token.italic ? "italic" : undefined,
        fontWeight: token.bold ? 600 : undefined,
      }}
    >
      {token.text}
    </span>
  );
}

/**
 * The typing caret. Its blink is derived from the frame number rather than a
 * CSS animation, so a seek lands on the same caret state every time and a
 * headless render reproduces it.
 */
function Caret({ theme, frame }: { theme: ThemeConfig; frame: number }) {
  const on = Math.floor(frame / 8) % 2 === 0;

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "0.55ch",
        marginRight: "-0.55ch",
        backgroundColor: theme.accent,
        opacity: on ? 1 : 0.15,
        verticalAlign: "text-bottom",
        height: "1em",
      }}
    />
  );
}

/** Appends an alpha byte to a 6-digit hex colour. */
function withAlpha(color: string, alpha: number): string {
  const byte = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");

  return color.length === 7 ? `${color}${byte}` : color;
}
