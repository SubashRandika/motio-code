"use client";

import { useEffect, useRef, useState } from "react";

import { getActiveSegments, type Timeline } from "@/core/animation";
import type { Project } from "@/core/model";

import { ElementView } from "./element-view";

/**
 * The composition preview.
 *
 * The stage is always laid out at the project's design resolution and then
 * scaled to fit, so element coordinates mean the same thing at any zoom level
 * and at any export resolution.
 */
export function CanvasStage({
  project,
  timeline,
  frame,
  selectedElementId,
  onSelectElement,
}: {
  project: Project;
  timeline: Timeline;
  frame: number;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fit = () => {
      const { width, height } = container.getBoundingClientRect();
      const padding = 48;
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

  return (
    <div
      ref={containerRef}
      className="canvas-grid relative flex flex-1 items-center justify-center overflow-hidden bg-ink-sunk"
      onPointerDown={(event) => {
        // A click on the backdrop clears the selection.
        if (event.target === event.currentTarget) onSelectElement(null);
      }}
    >
      <div
        style={{
          width: project.canvas.width * scale,
          height: project.canvas.height * scale,
        }}
        className="relative shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div
          style={{
            width: project.canvas.width,
            height: project.canvas.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: project.canvas.background,
          }}
          className="absolute top-0 left-0 overflow-hidden"
        >
          {active.length === 0 ? null : (
            active.map(({ segment, localFrame, transitionProgress }, index) => {
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
                        selected={element.id === selectedElementId}
                        onSelect={onSelectElement}
                      />
                    ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="tabular absolute right-3 bottom-3 rounded border border-line bg-ink/80 px-2 py-1 text-[11px] text-mist-dim">
        {project.canvas.width}×{project.canvas.height} · {Math.round(scale * 100)}%
      </p>
    </div>
  );
}
