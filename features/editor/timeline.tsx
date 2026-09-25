"use client";

import { Pause, Play, SkipBack, StepBack, StepForward } from "lucide-react";
import { useCallback, useRef } from "react";

import { formatTimecode, type Timeline } from "@/core/animation";
import type { Project } from "@/core/model";
import type { FrameClock } from "@/features/preview/use-frame-clock";
import { cn } from "@/lib/utils/cn";

export function TimelinePanel({
  project,
  timeline,
  clock,
  activeSceneId,
  selectedElementId,
  onSelectScene,
  onSelectElement,
}: {
  project: Project;
  timeline: Timeline;
  clock: FrameClock;
  activeSceneId: string;
  selectedElementId: string | null;
  onSelectScene: (sceneId: string) => void;
  onSelectElement: (elementId: string | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { durationInFrames } = timeline;
  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId);
  const activeSegment = timeline.segments.find((segment) => segment.sceneId === activeSceneId);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || durationInFrames === 0) return;

      const bounds = track.getBoundingClientRect();
      const ratio = (clientX - bounds.left) / bounds.width;
      clock.seek(Math.round(ratio * (durationInFrames - 1)));
    },
    [clock, durationInFrames],
  );

  const percent = durationInFrames > 1 ? (clock.frame / (durationInFrames - 1)) * 100 : 0;

  return (
    <section
      aria-label="Timeline"
      className="flex shrink-0 flex-col border-t border-line bg-panel"
    >
      {/* ------------------------------------------------------- transport */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <TransportButton label="Go to start" onClick={() => clock.seek(0)}>
          <SkipBack className="size-3.5" />
        </TransportButton>
        <TransportButton label="Previous frame" onClick={() => clock.step(-1)}>
          <StepBack className="size-3.5" />
        </TransportButton>

        <button
          type="button"
          onClick={clock.toggle}
          aria-label={clock.playing ? "Pause" : "Play"}
          className="grid size-8 place-items-center rounded-md bg-amber text-ink transition-colors hover:bg-amber-deep"
        >
          {clock.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>

        <TransportButton label="Next frame" onClick={() => clock.step(1)}>
          <StepForward className="size-3.5" />
        </TransportButton>

        <div className="tabular ml-3 flex items-baseline gap-2 text-[12px]">
          <span className="text-cyan">{formatTimecode(clock.frame, project.canvas.fps)}</span>
          <span className="text-mist-dim">
            / {formatTimecode(Math.max(0, durationInFrames - 1), project.canvas.fps)}
          </span>
        </div>

        <span className="tabular ml-auto text-[11px] text-mist-dim">
          frame {clock.frame} · {project.canvas.fps}fps · {durationInFrames} frames total
        </span>
      </div>

      {/* ---------------------------------------------------- scene strip */}
      <div className="px-3 pt-3">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, durationInFrames - 1)}
          aria-valuenow={clock.frame}
          aria-valuetext={`Frame ${clock.frame}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) seekFromPointer(event.clientX);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              clock.step(event.shiftKey ? -10 : -1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              clock.step(event.shiftKey ? 10 : 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              clock.seek(0);
            } else if (event.key === "End") {
              event.preventDefault();
              clock.seek(durationInFrames - 1);
            }
          }}
          className="relative h-9 cursor-col-resize touch-none rounded-sm bg-ink-sunk"
        >
          {timeline.segments.map((segment) => {
            const isActive = segment.sceneId === activeSceneId;
            const scene = project.scenes.find((item) => item.id === segment.sceneId);

            return (
              <button
                key={segment.sceneId}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  onSelectScene(segment.sceneId);
                  clock.seek(segment.start);
                }}
                className={cn(
                  "absolute inset-y-0 flex items-center overflow-hidden rounded-sm border px-2 text-left transition-colors",
                  isActive
                    ? "border-amber/60 bg-amber-wash text-amber"
                    : "border-line-strong bg-raised text-mist hover:border-line-strong hover:text-paper",
                )}
                style={{
                  left: `${(segment.start / durationInFrames) * 100}%`,
                  width: `${(segment.durationInFrames / durationInFrames) * 100}%`,
                }}
              >
                <span className="truncate text-[11px]">{scene?.name ?? "Scene"}</span>
              </button>
            );
          })}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-cyan"
            style={{ left: `${percent}%` }}
          >
            <span className="absolute -top-1 -left-[3.5px] size-2 rotate-45 rounded-[1px] bg-cyan" />
          </div>
        </div>

        <div
          className="frame-ruler-major mt-1 h-3 opacity-45"
          style={{ ["--tick-gap" as string]: "10px" }}
          aria-hidden="true"
        />
      </div>

      {/* --------------------------------------------------- element tracks */}
      <div className="max-h-40 min-h-24 overflow-y-auto px-3 pt-2 pb-3">
        {!activeScene || activeScene.data.elements.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-mist-dim">
            This scene has no elements yet. Element tracks appear here as you add them.
          </p>
        ) : (
          <ul className="space-y-1">
            {[...activeScene.data.elements]
              .sort((a, b) => b.layer - a.layer)
              .map((element) => {
                const end =
                  element.durationInFrames === null
                    ? activeScene.durationInFrames
                    : element.from + element.durationInFrames;
                const sceneStart = activeSegment?.start ?? 0;

                return (
                  <li key={element.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectElement(element.id)}
                      className={cn(
                        "w-28 shrink-0 truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors",
                        element.id === selectedElementId
                          ? "bg-amber-wash text-amber"
                          : "text-mist hover:text-paper",
                      )}
                    >
                      {element.name}
                    </button>

                    <div className="relative h-5 flex-1 rounded-sm bg-ink-sunk">
                      <div
                        className={cn(
                          "absolute inset-y-0 rounded-sm border",
                          element.id === selectedElementId
                            ? "border-amber/60 bg-amber-wash"
                            : "border-line-strong bg-raised",
                        )}
                        style={{
                          left: `${((sceneStart + element.from) / durationInFrames) * 100}%`,
                          width: `${((end - element.from) / durationInFrames) * 100}%`,
                        }}
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 w-px bg-cyan/60"
                        style={{ left: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </section>
  );
}

function TransportButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md border border-line bg-raised text-mist transition-colors hover:border-line-strong hover:text-paper"
    >
      {children}
    </button>
  );
}
