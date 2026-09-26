"use client";

import { resolveReveal, type ElementRenderState } from "@/core/animation";
import type { StepsElement, ThemeConfig } from "@/core/model";

/**
 * A sequence of steps.
 *
 * Vertically it is a process; horizontally with its connector on it is a
 * timeline. AGENTS.md lists both, but they are the same data laid out two ways,
 * so there is one element rather than two that would drift apart.
 *
 * A `reveal` walks down the steps, and the connector leading into a step fades
 * with it, so the line never runs ahead into empty space.
 */
export function StepsView({
  element,
  state,
  theme,
}: {
  element: StepsElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  const { content } = element;
  const { shown, partialProgress } = resolveReveal(state, content.steps.length);
  const vertical = content.orientation === "vertical";

  const markerSize = Math.round(content.fontSize * 1.4);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: "stretch",
        fontFamily: "var(--font-plex-sans)",
        color: theme.text,
      }}
    >
      {content.steps.map((step, index) => {
        const opacity = index < shown ? 1 : index === shown ? partialProgress : 0;

        return (
          <div
            key={index}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: vertical ? "row" : "column",
              alignItems: vertical ? "flex-start" : "center",
              gap: Math.round(content.fontSize * 0.5),
              opacity,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: vertical ? "column" : "row",
                alignItems: "center",
                alignSelf: vertical ? "stretch" : undefined,
                width: vertical ? markerSize : "100%",
                flexShrink: 0,
              }}
            >
              {/* The run of connector before this step. The first step has none,
                  so the sequence starts at its marker rather than in mid-air. */}
              <Rail
                visible={content.connector && index > 0}
                vertical={vertical}
                colour={theme.border}
              />
              <span
                style={{
                  width: markerSize,
                  height: markerSize,
                  flexShrink: 0,
                  borderRadius: "9999px",
                  border: `2px solid ${theme.accent}`,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-jetbrains)",
                  fontSize: Math.max(9, Math.round(content.fontSize * 0.62)),
                  color: theme.accent,
                }}
              >
                {content.numbered ? index + 1 : ""}
              </span>
              <Rail
                visible={content.connector && index < content.steps.length - 1}
                vertical={vertical}
                colour={theme.border}
              />
            </div>

            <div
              style={{
                minWidth: 0,
                paddingTop: vertical ? Math.round(content.fontSize * 0.1) : 0,
                textAlign: vertical ? "left" : "center",
              }}
            >
              <p style={{ margin: 0, fontSize: content.fontSize, fontWeight: 600 }}>{step.title}</p>
              {step.detail ? (
                <p
                  style={{
                    margin: `${Math.round(content.detailFontSize * 0.3)}px 0 0`,
                    fontSize: content.detailFontSize,
                    lineHeight: 1.4,
                    color: theme.muted,
                  }}
                >
                  {step.detail}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The line between two markers. Kept in the layout when hidden so the markers
 *  of every step line up with each other. */
function Rail({
  visible,
  vertical,
  colour,
}: {
  visible: boolean;
  vertical: boolean;
  colour: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: 1,
        alignSelf: "center",
        width: vertical ? 2 : undefined,
        height: vertical ? undefined : 2,
        minWidth: vertical ? 2 : 0,
        minHeight: vertical ? 0 : 2,
        backgroundColor: visible ? colour : "transparent",
      }}
    />
  );
}
