"use client";

import { useEffect, useRef, useState } from "react";

import { getActiveSegments, type Timeline } from "@/core/animation";
import { buildConnectorPath } from "@/core/diagram";
import {
  isConnector,
  isNode,
  type ConnectorElement,
  type Project,
  type SceneElement,
} from "@/core/model";

import { ConnectorLayer } from "./connector-layer";
import { ElementView } from "./element-view";
import { SelectionOverlay, type SelectionBox } from "./selection-overlay";
import { selectActiveScene } from "./store";
import { useEditorStore } from "./store-provider";
import { useCanvasInteraction } from "./use-canvas-interaction";

/**
 * The composition preview, and the surface you edit on.
 *
 * The stage is always laid out at the project's design resolution and then
 * scaled to fit, so element coordinates mean the same thing at any zoom level
 * and at any export resolution. Selection chrome is drawn in display pixels on
 * top, so handles stay the same physical size as you zoom.
 */
export function CanvasStage({ timeline, frame }: { timeline: Timeline; frame: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // The project comes from the store rather than a prop: the canvas reads both
  // the scene graph and the selection, and two sources for the same data is how
  // a stale render creeps in.
  const project = useEditorStore((state) => state.project);
  const activeScene = useEditorStore(selectActiveScene);
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds);
  const elements = activeScene?.data.elements ?? [];

  const interaction = useCanvasInteraction({
    stageRef,
    scale,
    canvas: project.canvas,
    elements,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fit = () => {
      const { width, height } = container.getBoundingClientRect();
      const padding = 56;
      const next = Math.min(
        (width - padding) / project.canvas.width,
        (height - padding) / project.canvas.height,
      );
      setScale(Math.max(0.05, Math.min(next, 2)));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [project.canvas.width, project.canvas.height]);

  const active = getActiveSegments(timeline, frame);
  const selectionBoxes = selectionBoxesFor(elements, selectedElementIds);

  return (
    <div
      ref={containerRef}
      className="canvas-grid relative flex flex-1 items-center justify-center overflow-hidden bg-ink-sunk"
    >
      <div
        ref={stageRef}
        data-canvas-stage
        onPointerDown={interaction.onPointerDown}
        onPointerMove={interaction.onPointerMove}
        onPointerUp={interaction.onPointerUp}
        onPointerCancel={interaction.onPointerUp}
        style={{
          width: project.canvas.width * scale,
          height: project.canvas.height * scale,
          backgroundColor: project.canvas.background,
          touchAction: "none",
        }}
        className="relative shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div
          style={{
            width: project.canvas.width,
            height: project.canvas.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="absolute top-0 left-0 overflow-hidden"
        >
          {active.map(({ segment, localFrame, transitionProgress }, index) => {
            const scene = project.scenes.find((item) => item.id === segment.sceneId);
            if (!scene) return null;

            // The incoming scene fades over the outgoing one during a transition.
            const isIncoming = index === active.length - 1 && active.length > 1;
            const opacity = isIncoming ? transitionProgress : 1;

            return (
              <div
                key={segment.sceneId}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity,
                  backgroundColor: scene.data.background ?? undefined,
                }}
              >
                <SceneElements
                  elements={scene.data.elements}
                  frame={localFrame}
                  sceneDurationInFrames={scene.durationInFrames}
                  project={project}
                />
              </div>
            );
          })}
        </div>

        <SelectionOverlay
          boxes={selectionBoxes}
          scale={scale}
          marquee={interaction.marquee}
          guides={interaction.guides}
          pending={interaction.pending}
          canvasWidth={project.canvas.width}
          canvasHeight={project.canvas.height}
          dragging={interaction.dragging}
        />
      </div>

      <p className="tabular absolute right-3 bottom-3 rounded border border-line bg-ink/80 px-2 py-1 text-[11px] text-mist-dim">
        {project.canvas.width}×{project.canvas.height} · {Math.round(scale * 100)}%
      </p>

      {elements.length === 0 ? (
        <p className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md border border-line bg-ink/85 px-3 py-1.5 text-[12px] text-mist">
          Add an element from the left panel to start this scene.
        </p>
      ) : null}
    </div>
  );
}

interface PaintOrder {
  /** Elements below the connector layer. */
  behind: SceneElement[];
  connectors: ConnectorElement[];
  /** Elements above the connector layer, nodes among them. */
  inFront: SceneElement[];
}

/**
 * Splits a scene into paint order.
 *
 * All connectors share one SVG layer, inserted at the lowest layer any
 * connector holds. Because a compiled diagram assigns connectors lower layers
 * than its nodes, routes land behind the boxes they join -- which is what makes
 * an arrow tuck under a node's edge instead of crossing it.
 */
export function paintOrder(elements: SceneElement[]): PaintOrder {
  const sorted = [...elements].sort((a, b) => a.layer - b.layer);
  const connectors = sorted.filter(isConnector);

  if (connectors.length === 0) {
    return { behind: sorted, connectors: [], inFront: [] };
  }

  const cut = connectors[0].layer;
  return {
    behind: sorted.filter((element) => !isConnector(element) && element.layer < cut),
    connectors,
    inFront: sorted.filter((element) => !isConnector(element) && element.layer >= cut),
  };
}

function SceneElements({
  elements,
  frame,
  sceneDurationInFrames,
  project,
}: {
  elements: SceneElement[];
  frame: number;
  sceneDurationInFrames: number;
  project: Project;
}) {
  const order = paintOrder(elements);

  const paint = (element: SceneElement) => (
    <ElementView
      key={element.id}
      element={element}
      frame={frame}
      sceneDurationInFrames={sceneDurationInFrames}
      theme={project.theme}
    />
  );

  return (
    <>
      {order.behind.map(paint)}
      {order.connectors.length > 0 ? (
        <ConnectorLayer
          connectors={order.connectors}
          elements={elements}
          frame={frame}
          sceneDurationInFrames={sceneDurationInFrames}
          canvas={project.canvas}
          theme={project.theme}
        />
      ) : null}
      {order.inFront.map(paint)}
    </>
  );
}

/**
 * Boxes for the selection overlay.
 *
 * A connector has no authored box -- its extent comes from the route between
 * the nodes it joins -- so it is measured here rather than read from `rect`,
 * which means a stale stored value can never draw a misplaced outline.
 */
export function selectionBoxesFor(
  elements: SceneElement[],
  selectedIds: string[],
): SelectionBox[] {
  const nodesById = new Map(elements.filter(isNode).map((node) => [node.id, node]));

  return elements
    .filter((element) => selectedIds.includes(element.id))
    .flatMap((element): SelectionBox[] => {
      if (!isConnector(element)) {
        return [
          {
            id: element.id,
            rect: element.rect,
            resizable: !element.locked,
            connectable: isNode(element) && !element.locked,
          },
        ];
      }

      const source = nodesById.get(element.content.sourceId);
      const target = nodesById.get(element.content.targetId);
      if (!source || !target) return [];

      const path = buildConnectorPath(source.rect, target.rect, {
        kind: element.content.kind,
        sourceAnchor: element.content.sourceAnchor,
        targetAnchor: element.content.targetAnchor,
      });

      return [{ id: element.id, rect: path.bbox, resizable: false, connectable: false }];
    });
}
