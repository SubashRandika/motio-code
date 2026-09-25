"use client";

import { Pause, Play, SkipBack, StepBack, StepForward } from "lucide-react";
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { formatTimecode, type Timeline } from "@/core/animation";
import type { Scene, SceneElement } from "@/core/model";
import type { FrameClock } from "@/features/preview/use-frame-clock";
import { cn } from "@/lib/utils/cn";

import { selectActiveScene } from "./store";
import { useEditorStore } from "./store-provider";

export function TimelinePanel({ timeline, clock }: { timeline: Timeline; clock: FrameClock }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const project = useEditorStore((state) => state.project);
  const activeScene = useEditorStore(selectActiveScene);
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds);
  const selectScene = useEditorStore((state) => state.selectScene);
  const selectElement = useEditorStore((state) => state.selectElement);

  const { durationInFrames } = timeline;
  const activeSegment = timeline.segments.find((segment) => segment.sceneId === activeScene?.id);

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
    <section aria-label="Timeline" className="flex shrink-0 flex-col border-t border-line bg-panel">
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
            const isActive = segment.sceneId === activeScene?.id;
            const scene = project.scenes.find((item) => item.id === segment.sceneId);

            return (
              <button
                key={segment.sceneId}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  selectScene(segment.sceneId);
                  clock.seek(segment.start);
                }}
                className={cn(
                  "absolute inset-y-0 flex items-center overflow-hidden rounded-sm border px-2 text-left transition-colors",
                  isActive
                    ? "border-amber/60 bg-amber-wash text-amber"
                    : "border-line-strong bg-raised text-mist hover:text-paper",
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

      {/* -------------------------------------------------- element tracks */}
      <div className="max-h-44 min-h-24 overflow-y-auto px-3 pt-2 pb-3">
        {!activeScene || activeScene.data.elements.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-mist-dim">
            This scene has no elements yet. Element tracks appear here as you add them.
          </p>
        ) : (
          <ul className="space-y-1">
            {[...activeScene.data.elements]
              .sort((a, b) => b.layer - a.layer)
              .map((element) => (
                <ElementTrack
                  key={element.id}
                  element={element}
                  scene={activeScene}
                  sceneStart={activeSegment?.start ?? 0}
                  totalFrames={durationInFrames}
                  playheadPercent={percent}
                  selected={selectedElementIds.includes(element.id)}
                  onSelect={(additive) => selectElement(element.id, { additive })}
                />
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type ClipDrag = {
  mode: "move" | "start" | "end";
  originX: number;
  trackWidth: number;
  from: number;
  duration: number;
  undoKey: string;
};

/**
 * One element's clip on the timeline.
 *
 * The body drags the whole clip, the edges trim it. Everything is converted to
 * whole frames before it reaches the store, so a clip can never land between
 * two frames.
 */
function ElementTrack({
  element,
  scene,
  sceneStart,
  totalFrames,
  playheadPercent,
  selected,
  onSelect,
}: {
  element: SceneElement;
  scene: Scene;
  sceneStart: number;
  totalFrames: number;
  playheadPercent: number;
  selected: boolean;
  onSelect: (additive: boolean) => void;
}) {
  const setElementTiming = useEditorStore((state) => state.setElementTiming);
  const drag = useRef<ClipDrag | null>(null);

  const duration = element.durationInFrames ?? scene.durationInFrames - element.from;

  // One handler for the body and both trim edges; each advertises its own mode
  // through data-drag-mode so no closure is created during render.
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (element.locked) return;

    const track = event.currentTarget.closest<HTMLElement>("[data-clip-track]");
    if (!track) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      mode: (event.currentTarget.dataset.dragMode ?? "move") as ClipDrag["mode"],
      originX: event.clientX,
      trackWidth: track.getBoundingClientRect().width,
      from: element.from,
      duration,
      undoKey: `clip:${element.id}:${Date.now()}`,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.trackWidth === 0) return;

    const deltaFrames = Math.round(
      ((event.clientX - current.originX) / current.trackWidth) * totalFrames,
    );
    const options = { coalesceKey: current.undoKey, coalesceWindowMs: Infinity };
    const maxFrom = Math.max(0, scene.durationInFrames - 1);

    if (current.mode === "move") {
      const from = Math.min(Math.max(0, current.from + deltaFrames), maxFrom);
      setElementTiming(element.id, { from }, options);
      return;
    }

    if (current.mode === "start") {
      // Trimming the head keeps the tail in place.
      const end = current.from + current.duration;
      const from = Math.min(Math.max(0, current.from + deltaFrames), end - 1);
      setElementTiming(element.id, { from, durationInFrames: end - from }, options);
      return;
    }

    const durationInFrames = Math.max(
      1,
      Math.min(current.duration + deltaFrames, scene.durationInFrames - current.from),
    );
    setElementTiming(element.id, { durationInFrames }, options);
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const left = ((sceneStart + element.from) / totalFrames) * 100;
  const width = (duration / totalFrames) * 100;

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={(event) => onSelect(event.shiftKey || event.metaKey)}
        className={cn(
          "w-28 shrink-0 truncate rounded px-1.5 py-1 text-left text-[11px] transition-colors",
          selected ? "bg-amber-wash text-amber" : "text-mist hover:text-paper",
        )}
      >
        {element.name}
      </button>

      <div data-clip-track className="relative h-5 flex-1 rounded-sm bg-ink-sunk">
        <div
          role="group"
          aria-label={`${element.name} timing`}
          data-drag-mode="move"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "absolute inset-y-0 touch-none rounded-sm border",
            element.locked ? "cursor-not-allowed" : "cursor-grab",
            selected ? "border-amber/60 bg-amber-wash" : "border-line-strong bg-raised",
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
        >
          <span
            aria-hidden="true"
            data-drag-mode="start"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize touch-none rounded-l-sm hover:bg-amber/40"
          />
          <span
            aria-hidden="true"
            data-drag-mode="end"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize touch-none rounded-r-sm hover:bg-amber/40"
          />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-cyan/60"
          style={{ left: `${playheadPercent}%` }}
        />
      </div>

      <span className="tabular w-20 shrink-0 text-right text-[10.5px] text-mist-dim">
        {element.from}–{element.from + duration}f
      </span>
    </li>
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
