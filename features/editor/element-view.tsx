"use client";

import { resolveElementState, resolveReveal, type ElementRenderState } from "@/core/animation";
import type { SceneElement, ThemeConfig } from "@/core/model";

import { NodeView } from "./node-view";

/**
 * Draws one element at one frame.
 *
 * The component reads *only* from the resolved render state, never from a CSS
 * transition or browser animation, so the same frame produces the same pixels
 * whether it is painted in the editor or by a headless renderer.
 */
export function ElementView({
  element,
  frame,
  sceneDurationInFrames,
  theme,
}: {
  element: SceneElement;
  frame: number;
  sceneDurationInFrames: number;
  theme: ThemeConfig;
}) {
  // Connectors are drawn together in ConnectorLayer: their geometry comes from
  // the nodes they join, so they cannot be positioned by their own box.
  if (element.type === "connector") return null;

  const state = resolveElementState(element, frame, sceneDurationInFrames);
  if (!state.visible) return null;

  const { rect, style } = element;

  // A node paints its own outline as SVG, so the wrapper must not draw a box
  // behind a diamond or clip the stroke of a cylinder.
  const isDiagramNode = element.type === "node";

  return (
    <div
      data-element-id={element.id}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: state.opacity,
        transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
        backgroundColor: isDiagramNode ? undefined : (style.fill ?? undefined),
        border:
          isDiagramNode || !style.stroke
            ? undefined
            : `${style.strokeWidth}px solid ${style.stroke}`,
        borderRadius: isDiagramNode ? undefined : style.cornerRadius,
        padding: isDiagramNode ? undefined : style.padding,
        boxShadow: style.shadow ? "0 18px 40px rgba(0,0,0,0.35)" : undefined,
        overflow: isDiagramNode ? "visible" : "hidden",
        // Selection chrome lives in the overlay above the stage; the element
        // itself only advertises that it can be picked up.
        cursor: element.locked ? "default" : "move",
      }}
    >
      <ElementContent element={element} state={state} theme={theme} />
      {!isDiagramNode && state.highlight && state.highlight.strength > 0.01 ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: state.highlight.color,
            opacity: state.highlight.strength * 0.25,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

function ElementContent({
  element,
  state,
  theme,
}: {
  element: SceneElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  switch (element.type) {
    case "text": {
      const { content } = element;
      return (
        <p
          style={{
            margin: 0,
            fontFamily: `var(--font-${content.font === "mono" ? "jetbrains" : content.font === "display" ? "bricolage" : "plex-sans"})`,
            fontSize: content.fontSize,
            fontWeight: content.fontWeight,
            lineHeight: content.lineHeight,
            letterSpacing: `${content.letterSpacing}em`,
            textAlign: content.align,
            color: content.color,
            textTransform: content.uppercase ? "uppercase" : "none",
            whiteSpace: "pre-wrap",
          }}
        >
          {content.text}
        </p>
      );
    }

    case "shape": {
      // Fill, stroke and radius already come from the shared style block.
      if (element.content.shape === "ellipse") {
        return <span style={{ position: "absolute", inset: 0, borderRadius: "9999px", backgroundColor: element.style.fill ?? theme.surface }} />;
      }
      if (element.content.shape === "line") {
        return (
          <span
            style={{
              position: "absolute",
              insetInline: 0,
              top: "50%",
              height: Math.max(1, element.style.strokeWidth),
              backgroundColor: element.style.stroke ?? theme.border,
            }}
          />
        );
      }
      return null;
    }

    case "code": {
      const lines = element.content.code.split("\n");
      const { shown, partialProgress } = resolveReveal(state, lines.length);

      return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {element.content.showWindowChrome ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderBottom: `1px solid ${theme.border}`,
                color: theme.muted,
                fontFamily: "var(--font-jetbrains)",
                fontSize: Math.max(10, element.content.fontSize * 0.66),
              }}
            >
              {element.content.title || element.content.language}
            </div>
          ) : null}

          <pre
            style={{
              margin: 0,
              padding: 12,
              overflow: "hidden",
              fontFamily: "var(--font-jetbrains)",
              fontSize: element.content.fontSize,
              lineHeight: element.content.lineHeight,
              color: theme.text,
            }}
          >
            <code>
              {lines.map((line, index) => {
                const lineOpacity =
                  index < shown ? 1 : index === shown ? partialProgress : 0;
                const highlighted = element.content.highlightedLines.includes(index + 1);

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      opacity: lineOpacity,
                      backgroundColor: highlighted ? `${theme.accent}22` : undefined,
                    }}
                  >
                    {element.content.showLineNumbers ? (
                      <span
                        style={{
                          width: "3ch",
                          textAlign: "right",
                          marginRight: "1.5ch",
                          color: theme.muted,
                          userSelect: "none",
                        }}
                      >
                        {index + 1}
                      </span>
                    ) : null}
                    <span>{line || " "}</span>
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
      );
    }

    case "callout": {
      const tint =
        element.content.tone === "accent"
          ? theme.accent
          : element.content.tone === "warning"
            ? theme.accentAlt
            : theme.border;

      return (
        <div
          style={{
            height: "100%",
            padding: 12,
            borderLeft: `3px solid ${tint}`,
            backgroundColor: theme.surface,
            color: theme.text,
          }}
        >
          {element.content.label ? (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-jetbrains)",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: tint,
              }}
            >
              {element.content.label}
            </p>
          ) : null}
          <p style={{ margin: element.content.label ? "6px 0 0" : 0, lineHeight: 1.45 }}>
            {element.content.body}
          </p>
        </div>
      );
    }

    case "node":
      return <NodeView element={element} state={state} theme={theme} />;

    case "connector":
      // Unreachable: ElementView returns before this for connectors.
      return null;

    case "image": {
      // Assets arrive with the asset pipeline; until then the slot is explicit
      // rather than silently blank.
      return (
        <div
          style={{
            height: "100%",
            display: "grid",
            placeItems: "center",
            border: `1px dashed ${theme.border}`,
            color: theme.muted,
            fontFamily: "var(--font-jetbrains)",
            fontSize: 12,
          }}
        >
          {element.content.alt || "Image"}
        </div>
      );
    }
  }
}
