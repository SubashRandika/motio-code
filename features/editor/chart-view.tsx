"use client";

import type { ElementRenderState } from "@/core/animation";
import { chartLayout, formatNumber } from "@/core/infographic";
import type { ChartElement, ThemeConfig } from "@/core/model";

/**
 * A bar chart.
 *
 * Each bar's length and the figure printed beside it come from the same number,
 * so the two can never disagree. A `count` animation grows every bar together; a
 * `reveal` brings them in one at a time. With neither, the chart simply shows the
 * data.
 *
 * Deliberately no axes or gridlines: the MVP is a technical storytelling tool,
 * not a charting platform, and a labelled bar is what a slide actually needs.
 */
export function ChartView({
  element,
  state,
  theme,
}: {
  element: ChartElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  const { content } = element;
  const bars = chartLayout(content.bars, content.max, state);
  const vertical = content.orientation === "vertical";

  const format = { decimals: content.decimals, suffix: content.suffix };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: vertical ? "row" : "column",
        alignItems: "stretch",
        gap: content.gap,
      }}
    >
      {bars.map((bar, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            display: "flex",
            // A vertical bar grows from the bottom, a horizontal one from the left.
            flexDirection: vertical ? "column" : "row",
            alignItems: vertical ? "center" : "center",
            gap: Math.round(content.fontSize * 0.35),
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {vertical ? (
            <>
              {content.showValues ? (
                <Value text={formatNumber(bar.shownValue, format)} size={content.fontSize} color={theme.text} />
              ) : null}
              <div
                style={{
                  flex: 1,
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-end",
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${bar.fraction * 100}%`,
                    backgroundColor: bar.color ?? theme.accent,
                    borderRadius: 4,
                  }}
                />
              </div>
              <Label text={bar.label} size={content.fontSize} color={theme.muted} />
            </>
          ) : (
            <>
              <Label
                text={bar.label}
                size={content.fontSize}
                color={theme.muted}
                style={{ width: "22%", textAlign: "right", flexShrink: 0 }}
              />
              <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
                <div
                  style={{
                    width: `${bar.fraction * 100}%`,
                    height: "100%",
                    backgroundColor: bar.color ?? theme.accent,
                    borderRadius: 4,
                  }}
                />
              </div>
              {content.showValues ? (
                <Value text={formatNumber(bar.shownValue, format)} size={content.fontSize} color={theme.text} />
              ) : null}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Value({ text, size, color }: { text: string; size: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains)",
        fontVariantNumeric: "tabular-nums",
        fontSize: size,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function Label({
  text,
  size,
  color,
  style,
}: {
  text: string;
  size: number;
  color: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-plex-sans)",
        fontSize: size,
        color,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        ...style,
      }}
    >
      {text}
    </span>
  );
}
