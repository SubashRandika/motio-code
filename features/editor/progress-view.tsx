"use client";

import type { ElementRenderState } from "@/core/animation";
import { formatNumber, progressFraction } from "@/core/infographic";
import type { ProgressElement, ThemeConfig } from "@/core/model";

/**
 * A progress bar or ring.
 *
 * The readout and the geometry come from the same number, so a label can never
 * disagree with the shape beside it. The ring is drawn with a normalised
 * `pathLength`, the same trick the connector draw-on uses, so the dash maths
 * needs no DOM measurement and works headlessly.
 */
export function ProgressView({
  element,
  state,
  theme,
}: {
  element: ProgressElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  const { content } = element;
  const { fraction, shownValue } = progressFraction(content.value, content.max, state);

  const track = content.track ?? theme.border;
  const fill = content.fill ?? theme.accent;
  const readout = formatNumber(shownValue, { decimals: 0, suffix: content.suffix });

  if (content.shape === "ring") {
    return (
      <RingProgress
        element={element}
        fraction={fraction}
        readout={readout}
        track={track}
        fill={fill}
        theme={theme}
      />
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.round(content.fontSize * 0.5),
      }}
    >
      {content.label || content.showValue ? (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            fontFamily: "var(--font-plex-sans)",
            fontSize: content.fontSize,
            color: theme.text,
          }}
        >
          <span>{content.label}</span>
          {content.showValue ? (
            <span
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontVariantNumeric: "tabular-nums",
                color: fill,
              }}
            >
              {readout}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          width: "100%",
          height: content.thickness,
          borderRadius: content.thickness / 2,
          backgroundColor: track,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${fraction * 100}%`,
            height: "100%",
            borderRadius: content.thickness / 2,
            backgroundColor: fill,
          }}
        />
      </div>
    </div>
  );
}

function RingProgress({
  element,
  fraction,
  readout,
  track,
  fill,
  theme,
}: {
  element: ProgressElement;
  fraction: number;
  readout: string;
  track: string;
  fill: string;
  theme: ThemeConfig;
}) {
  const { content, rect } = element;

  // The ring is square, so it stays circular whatever box the user drags.
  const size = Math.min(rect.width, rect.height);
  const radius = Math.max(1, (size - content.thickness) / 2);
  const centre = size / 2;

  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ display: "block" }}>
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke={track}
            strokeWidth={content.thickness}
          />
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke={fill}
            strokeWidth={content.thickness}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - fraction}
            // Start at twelve o'clock rather than three.
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {content.showValue ? (
            <span
              style={{
                fontFamily: "var(--font-jetbrains)",
                fontVariantNumeric: "tabular-nums",
                fontSize: content.fontSize,
                fontWeight: 600,
                color: theme.text,
              }}
            >
              {readout}
            </span>
          ) : null}
          {content.label ? (
            <span
              style={{
                fontFamily: "var(--font-plex-sans)",
                fontSize: Math.max(10, content.fontSize * 0.5),
                color: theme.muted,
                textAlign: "center",
              }}
            >
              {content.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
