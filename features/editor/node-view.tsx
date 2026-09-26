"use client";

import {
  Box,
  Braces,
  Cloud,
  Database,
  Globe,
  HardDrive,
  Layers,
  ListOrdered,
  Lock,
  Plug,
  Server,
  User,
  Zap,
} from "lucide-react";

import type { ElementRenderState } from "@/core/animation";
import type { NodeElement, NodeIcon, ThemeConfig } from "@/core/model";

const ICONS: Record<Exclude<NodeIcon, "none">, typeof Server> = {
  server: Server,
  database: Database,
  cloud: Cloud,
  user: User,
  queue: ListOrdered,
  function: Braces,
  cache: Zap,
  browser: Globe,
  api: Plug,
  storage: HardDrive,
  lock: Lock,
  container: Box,
  event: Layers,
};

/**
 * A diagram node.
 *
 * The outline is inline SVG rather than CSS borders, because a diamond, hexagon
 * or cylinder cannot be drawn with `border-radius` and a clip-path would throw
 * the border away. One SVG per shape keeps fill, stroke and stroke width
 * behaving identically across all seven.
 */
export function NodeView({
  element,
  state,
  theme,
}: {
  element: NodeElement;
  state: ElementRenderState;
  theme: ThemeConfig;
}) {
  const { width, height } = element.rect;
  const { content, style } = element;
  const accent = content.accent ?? theme.accent;
  const stroke = style.stroke ?? theme.border;
  const strokeWidth = style.strokeWidth;
  const fill = style.fill ?? theme.surface;
  const Icon = content.icon === "none" ? null : ICONS[content.icon];

  // A highlight tints the outline as well as the body, so a node being pointed
  // at reads clearly even at small sizes.
  const highlightStrength = state.highlight?.strength ?? 0;
  const outline = highlightStrength > 0.01 ? (state.highlight?.color ?? accent) : stroke;

  return (
    <>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        aria-hidden="true"
      >
        <NodeShape
          shape={content.shape}
          width={width}
          height={height}
          fill={fill}
          stroke={outline}
          strokeWidth={strokeWidth}
          cornerRadius={style.cornerRadius}
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
          gap: Math.round(content.fontSize * 0.28),
          padding: Math.round(content.fontSize * 0.7),
          textAlign: content.align,
          pointerEvents: "none",
        }}
      >
        {Icon ? (
          <Icon
            size={Math.round(content.fontSize * 1.1)}
            color={accent}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : null}

        <span
          style={{
            fontFamily: "var(--font-plex-sans)",
            fontSize: content.fontSize,
            fontWeight: 600,
            lineHeight: 1.25,
            color: theme.text,
            overflowWrap: "anywhere",
          }}
        >
          {content.label}
        </span>

        {content.sublabel ? (
          <span
            style={{
              fontFamily: "var(--font-jetbrains)",
              fontSize: Math.round(content.fontSize * 0.68),
              lineHeight: 1.3,
              color: theme.muted,
              overflowWrap: "anywhere",
            }}
          >
            {content.sublabel}
          </span>
        ) : null}
      </div>
    </>
  );
}

function NodeShape({
  shape,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  cornerRadius,
}: {
  shape: NodeElement["content"]["shape"];
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}) {
  // Inset by half the stroke so the outline sits inside the element's box.
  const inset = strokeWidth / 2;
  const w = Math.max(0, width - strokeWidth);
  const h = Math.max(0, height - strokeWidth);
  const common = { fill, stroke, strokeWidth };

  switch (shape) {
    case "rectangle":
    case "rounded":
    case "pill":
      return (
        <rect
          x={inset}
          y={inset}
          width={w}
          height={h}
          rx={shape === "rectangle" ? 0 : shape === "pill" ? h / 2 : cornerRadius}
          {...common}
        />
      );

    case "circle":
      return <ellipse cx={width / 2} cy={height / 2} rx={w / 2} ry={h / 2} {...common} />;

    case "diamond":
      return (
        <polygon
          points={`${width / 2},${inset} ${width - inset},${height / 2} ${width / 2},${height - inset} ${inset},${height / 2}`}
          {...common}
        />
      );

    case "hexagon": {
      const notch = Math.min(width * 0.18, height * 0.5);
      return (
        <polygon
          points={[
            `${inset + notch},${inset}`,
            `${width - inset - notch},${inset}`,
            `${width - inset},${height / 2}`,
            `${width - inset - notch},${height - inset}`,
            `${inset + notch},${height - inset}`,
            `${inset},${height / 2}`,
          ].join(" ")}
          {...common}
        />
      );
    }

    case "cylinder": {
      // A store: an open-topped tube, so the two side walls are stroked but the
      // body's top and bottom are not.
      const lid = Math.min(height * 0.16, 24);
      return (
        <>
          <rect x={inset} y={lid} width={w} height={Math.max(0, h - lid)} fill={fill} />
          <ellipse
            cx={width / 2}
            cy={height - lid}
            rx={w / 2}
            ry={lid}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <path
            d={`M ${inset} ${lid} L ${inset} ${height - lid} M ${width - inset} ${lid} L ${width - inset} ${height - lid}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <ellipse
            cx={width / 2}
            cy={lid}
            rx={w / 2}
            ry={lid}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </>
      );
    }
  }
}
