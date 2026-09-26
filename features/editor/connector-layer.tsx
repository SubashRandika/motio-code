"use client";

import { resolveElementState } from "@/core/animation";
import {
  angleAtProgress,
  buildConnectorPath,
  labelPoint,
  pointAtProgress,
  type ConnectorPath,
} from "@/core/diagram";
import type { CanvasConfig, ConnectorElement, SceneElement, ThemeConfig } from "@/core/model";
import { isNode } from "@/core/model";

/**
 * Every connector in a scene, drawn in one SVG.
 *
 * A connector's geometry is *derived* from the boxes it joins, never authored,
 * so a node can be dragged anywhere and the route follows without any stored
 * value going stale. One SVG for the whole scene rather than one per connector
 * keeps a large diagram cheap to paint.
 */
export function ConnectorLayer({
  connectors,
  elements,
  frame,
  sceneDurationInFrames,
  canvas,
  theme,
}: {
  connectors: ConnectorElement[];
  elements: SceneElement[];
  frame: number;
  sceneDurationInFrames: number;
  canvas: CanvasConfig;
  theme: ThemeConfig;
}) {
  const nodesById = new Map(elements.filter(isNode).map((node) => [node.id, node]));

  return (
    <svg
      width={canvas.width}
      height={canvas.height}
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      // pointer-events is inherited, so the hit paths below re-enable it for
      // themselves; empty space in this layer stays click-through.
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {connectors.map((connector) => {
        const source = nodesById.get(connector.content.sourceId);
        const target = nodesById.get(connector.content.targetId);
        // A connector whose endpoints are gone is pruned on delete and on load;
        // skipping here keeps a hand-edited scene from crashing the canvas.
        if (!source || !target) return null;

        return (
          <Connector
            key={connector.id}
            connector={connector}
            sourceRect={source.rect}
            targetRect={target.rect}
            frame={frame}
            sceneDurationInFrames={sceneDurationInFrames}
            theme={theme}
          />
        );
      })}
    </svg>
  );
}

function Connector({
  connector,
  sourceRect,
  targetRect,
  frame,
  sceneDurationInFrames,
  theme,
}: {
  connector: ConnectorElement;
  sourceRect: SceneElement["rect"];
  targetRect: SceneElement["rect"];
  frame: number;
  sceneDurationInFrames: number;
  theme: ThemeConfig;
}) {
  const state = resolveElementState(connector, frame, sceneDurationInFrames);
  if (!state.visible) return null;

  const { content, style } = connector;
  const path = buildConnectorPath(sourceRect, targetRect, {
    kind: content.kind,
    sourceAnchor: content.sourceAnchor,
    targetAnchor: content.targetAnchor,
  });

  const stroke =
    state.highlight && state.highlight.strength > 0.01
      ? state.highlight.color
      : (style.stroke ?? theme.muted);
  const width = content.thickness;
  const reveal = state.revealProgress;
  const label = content.label ? labelPoint(path) : null;

  return (
    <g
      opacity={state.opacity}
      transform={`translate(${state.translateX} ${state.translateY})`}
      style={{ pointerEvents: "none" }}
    >
      {/* A fat invisible stroke makes a thin route easy to click. */}
      <path
        data-element-id={connector.id}
        d={path.d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(18, width * 4)}
        style={{ pointerEvents: connector.locked ? "none" : "stroke", cursor: "pointer" }}
      />

      <path
        d={path.d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={
          // A reveal draws the route on. `pathLength="1"` normalises the dash
          // pattern so the maths needs no DOM measurement and stays identical
          // in a headless render.
          reveal < 1 ? "1" : content.dashed ? `${width * 3} ${width * 2.5}` : undefined
        }
        strokeDashoffset={reveal < 1 ? 1 - reveal : undefined}
        pathLength={reveal < 1 ? 1 : undefined}
      />

      {content.endArrow ? (
        <Arrowhead path={path} progress={reveal} color={stroke} size={width * 3.2} />
      ) : null}

      {content.startArrow ? (
        <Arrowhead path={path} progress={0} color={stroke} size={width * 3.2} flip />
      ) : null}

      {state.flow
        ? Array.from({ length: state.flow.markers }, (_, index) => {
            // Markers are evenly spaced around the route and wrap at the end.
            const offset = index / state.flow!.markers;
            const at = (state.flow!.progress + offset) % 1;
            const point = pointAtProgress(path, at);

            return (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={state.flow!.size / 2}
                fill={state.flow!.color}
              />
            );
          })
        : null}

      {label ? (
        <text
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-jetbrains)"
          fontSize={Math.max(12, width * 7)}
          fill={theme.text}
          opacity={reveal}
          // Painting the stroke first knocks the route out from behind the text
          // without needing a background rectangle.
          stroke={theme.background}
          strokeWidth={Math.max(4, width * 3)}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {content.label}
        </text>
      ) : null}
    </g>
  );
}

/** A triangle that rides the head of the route as it draws on. */
function Arrowhead({
  path,
  progress,
  color,
  size,
  flip,
}: {
  path: ConnectorPath;
  progress: number;
  color: string;
  size: number;
  flip?: boolean;
}) {
  if (progress <= 0.001 && !flip) return null;

  const point = pointAtProgress(path, progress);
  const angle = angleAtProgress(path, progress) + (flip ? Math.PI : 0);
  const degrees = (angle * 180) / Math.PI;

  return (
    <polygon
      points={`0,0 ${-size},${size * 0.42} ${-size},${-size * 0.42}`}
      fill={color}
      transform={`translate(${point.x} ${point.y}) rotate(${degrees})`}
    />
  );
}
