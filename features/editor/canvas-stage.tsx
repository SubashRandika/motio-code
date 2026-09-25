"use client";

import { useEffect, useRef, useState } from "react";

import { getActiveSegments, type Timeline } from "@/core/animation";
import type { Project } from "@/core/model";

import { ElementView } from "./element-view";
import { SelectionOverlay } from "./selection-overlay";
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
export function CanvasStage({
  project,
  timeline,
  frame,
}: {
  project: Project;
  timeline: Timeline;
  frame: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

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
  const selectedElements = elements.filter((element) => selectedElementIds.includes(element.id));

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
                {[...scene.data.elements]
                  .sort((a, b) => a.layer - b.layer)
                  .map((element) => (
                    <ElementView
                      key={element.id}
                      element={element}
                      frame={localFrame}
                      sceneDurationInFrames={scene.durationInFrames}
                      theme={project.theme}
                    />
                  ))}
              </div>
            );
          })}
        </div>

        <SelectionOverlay
          elements={selectedElements}
          scale={scale}
          marquee={interaction.marquee}
          guides={interaction.guides}
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
