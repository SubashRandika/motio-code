"use client";

import { resolveReveal, type ElementRenderState } from "@/core/animation";
import type { ComparisonElement, ThemeConfig } from "@/core/model";

/**
 * A two-column comparison.
 *
 * Rows are text, not numbers -- this is the "REST vs GraphQL" table, not a chart.
 * A `reveal` brings the rows in one at a time; the column headings are always
 * present, because a half-built table with no headings reads as broken rather
 * than as arriving.
 */
export function ComparisonView({
  element,
  state,
  theme,
}: {
  element: ComparisonElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  const { content } = element;
  const { shown, partialProgress } = resolveReveal(state, content.rows.length);

  const favouredTint = `${theme.accent}14`;
  const columnStyle = (side: "left" | "right"): React.CSSProperties => ({
    flex: 1,
    minWidth: 0,
    padding: `0 ${Math.round(content.fontSize * 0.5)}px`,
    backgroundColor: content.favour === side ? favouredTint : undefined,
  });

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-plex-sans)",
        fontSize: content.fontSize,
        color: theme.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          padding: `${Math.round(content.fontSize * 0.6)}px 0`,
          borderBottom: `1px solid ${theme.border}`,
          fontSize: Math.max(10, content.fontSize * 0.7),
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: theme.muted,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, paddingLeft: Math.round(content.fontSize * 0.5) }} />
        <span style={columnStyle("left")}>{content.leftTitle}</span>
        <span style={columnStyle("right")}>{content.rightTitle}</span>
      </div>

      {content.rows.map((row, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "baseline",
            flex: 1,
            minHeight: 0,
            paddingTop: Math.round(content.fontSize * 0.4),
            paddingBottom: Math.round(content.fontSize * 0.4),
            borderBottom:
              index === content.rows.length - 1 ? undefined : `1px solid ${theme.border}`,
            opacity: index < shown ? 1 : index === shown ? partialProgress : 0,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: Math.round(content.fontSize * 0.5),
              color: theme.muted,
            }}
          >
            {row.label}
          </span>
          <span style={columnStyle("left")}>{row.left}</span>
          <span style={columnStyle("right")}>{row.right}</span>
        </div>
      ))}
    </div>
  );
}
