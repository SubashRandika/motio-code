"use client";

import type { ElementRenderState } from "@/core/animation";
import { animatedValue, formatNumber } from "@/core/infographic";
import type { CounterElement, ThemeConfig } from "@/core/model";

/**
 * A number the viewer is meant to read.
 *
 * The figure is always derived from the element's stored value scaled by the
 * animation's progress, so the last frame shows exactly what is in the data. The
 * digits are tabular so the number does not jitter horizontally while it counts.
 */
export function CounterView({
  element,
  state,
  theme,
}: {
  element: CounterElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  const { content } = element;
  const shown = animatedValue(content.value, state);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems:
          content.align === "left" ? "flex-start" : content.align === "right" ? "flex-end" : "center",
        gap: Math.round(content.labelFontSize * 0.35),
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-jetbrains)",
          fontVariantNumeric: "tabular-nums",
          fontSize: content.fontSize,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: content.color,
        }}
      >
        {formatNumber(shown, content)}
      </span>

      {content.label ? (
        <span
          style={{
            fontFamily: "var(--font-plex-sans)",
            fontSize: content.labelFontSize,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: theme.muted,
          }}
        >
          {content.label}
        </span>
      ) : null}
    </div>
  );
}
