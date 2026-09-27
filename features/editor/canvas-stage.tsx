"use client";

import { useEffect, useRef, useState } from "react";

import type { Timeline } from "@/core/animation";
import { buildConnectorPath } from "@/core/diagram";
import { isConnector, isNode, type SceneElement } from "@/core/model";
import { ProjectComposition } from "@/features/preview/composition";

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

  const selectionBoxes = selectionBoxesFor(elements, selectedElementIds);
  const selectedNames = elements
    .filter((element) => selectedElementIds.includes(element.id))
    .map((element) => element.name);

  return (
    <section
      ref={containerRef}
      aria-label="Canvas"
      className="canvas-grid relative flex flex-1 items-center justify-center overflow-hidden bg-ink-sunk"
    >
      {/*
        Direct manipulation on the stage -- drag, marquee, resize handles,
        connect nubs -- is pointer-only, and the honest position is that it will
        stay that way: dragging a box is not a gesture a keyboard has.

        What matters is that nothing is *only* reachable that way. Selection is
        in the Layers list, position and size are number fields in the properties
        panel, timing is on the timeline clip and in those fields too. So the
        keyboard route to every property exists; it is just not this surface.

        This region is named so it can be found and skipped, and announces what
        is selected, because the selection outline is drawn in pixels and says
        nothing otherwise.
      */}
      <p role="status" className="sr-only">
        {selectedNames.length === 0
          ? "Nothing selected."
          : selectedNames.length === 1
            ? `${selectedNames[0]} selected.`
            : `${selectedNames.length} elements selected: ${selectedNames.join(", ")}.`}
      </p>
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
          {/* The same tree the renderer draws. The editor only adds the scaling
              wrapper above and the selection chrome below. */}
          <ProjectComposition project={project} frame={frame} timeline={timeline} />
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
    </section>
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
