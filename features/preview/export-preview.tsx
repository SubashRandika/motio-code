"use client";

import { Player } from "@remotion/player";
import { useMemo, useState } from "react";

import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Modal } from "@/components/ui/modal";
import {
  EXPORT_RESOLUTIONS,
  exportDimensions,
  type ExportResolution,
  type Project,
} from "@/core/model";
import { planRender, renderDurationInSeconds } from "@/core/render";
import { ExportControls } from "@/features/export/export-controls";

import { MotioComposition } from "./motio-composition";

/**
 * Preview quality.
 *
 * "Full" previews at the resolution the project will export at. "Draft" previews
 * at 720p, which is the same composition at fewer pixels: the browser lays out
 * and paints less per frame, so a heavy project plays at its real speed instead
 * of stuttering. It changes nothing about the export -- only how many pixels the
 * preview asks the browser for.
 */
const QUALITY: Record<"draft" | "full", ExportResolution | null> = {
  draft: "720p",
  full: null,
};

export function ExportPreview({ project, onClose }: { project: Project; onClose: () => void }) {
  const [quality, setQuality] = useState<keyof typeof QUALITY>("full");

  // What the export will actually be, regardless of what is previewed.
  const exportPlan = useMemo(() => planRender(project, project.export), [project]);

  const previewPlan = useMemo(() => {
    const override = QUALITY[quality];
    return override
      ? planRender(project, { ...project.export, resolution: override })
      : exportPlan;
  }, [project, quality, exportPlan]);

  const seconds = renderDurationInSeconds(exportPlan);

  return (
    <Modal
      title="Preview"
      onClose={onClose}
      className="w-[min(60rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        <p className="text-[12.5px] leading-relaxed text-mist">
          This is the composition as it will be rendered: the same frames, the same framing, at
          the export settings below.
        </p>

        <div
          className="overflow-hidden rounded-md border border-line bg-ink-sunk"
          style={{ aspectRatio: `${previewPlan.width} / ${previewPlan.height}` }}
        >
          {/*
            The Player is third-party code rendering user content, which is two
            reasons for it not to be able to take the editor with it. Bounded
            here rather than around the whole modal so the export controls below
            stay usable: a preview that cannot play does not mean a render that
            cannot run, and someone who knows their project is fine should still
            be able to export it.

            The quality toggle is a reset key, so switching draft/full is also
            the way to retry a Player that failed once.
          */}
          <ErrorBoundary
            resetKeys={[quality, project]}
            fallback={() => (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-[13px] font-medium text-paper">
                  The preview could not be played
                </p>
                <p className="max-w-sm text-[12px] leading-relaxed text-mist">
                  Switching the preview quality below will try again. Exporting does not use the
                  player, so it may still work.
                </p>
              </div>
            )}
          >
            <Player
              component={MotioComposition}
              inputProps={{ project, plan: previewPlan }}
              durationInFrames={previewPlan.durationInFrames}
              fps={previewPlan.fps}
              compositionWidth={previewPlan.width}
              compositionHeight={previewPlan.height}
              controls
              loop
              doubleClickToFullscreen
              style={{ width: "100%", height: "100%" }}
            />
          </ErrorBoundary>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <dl className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-mist-dim">
            <Fact label="Output">
              {exportPlan.width}×{exportPlan.height}
            </Fact>
            <Fact label="Rate">{exportPlan.fps} fps</Fact>
            <Fact label="Length">{seconds.toFixed(1)}s</Fact>
            <Fact label="Frames">{exportPlan.durationInFrames}</Fact>
          </dl>

          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Preview quality</legend>
            {(["full", "draft"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded border px-2 py-1 text-[11.5px] capitalize transition-colors ${
                  quality === value
                    ? "border-amber/60 bg-amber-wash text-paper"
                    : "border-line bg-raised text-mist hover:text-paper"
                }`}
              >
                <input
                  type="radio"
                  name="preview-quality"
                  value={value}
                  checked={quality === value}
                  onChange={() => setQuality(value)}
                  className="sr-only"
                />
                {value === "draft" ? "Draft 720p" : "Full quality"}
              </label>
            ))}
          </fieldset>
        </div>

        <ExportControls project={project} />

        {exportPlan.letterboxed ? (
          <p className="rounded-md border border-amber/30 bg-amber-wash px-3 py-2 text-[12px] leading-relaxed text-mist">
            The export is {project.export.aspectRatio} but this project was composed at{" "}
            {project.canvas.aspectRatio}, so it is scaled to fit and centred. Nothing is cropped —
            set the export ratio to {project.canvas.aspectRatio} to fill the frame.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-mist-dim">{label}</dt>
      <dd className="text-mist">{children}</dd>
    </div>
  );
}

/** The dimensions a resolution produces, for the settings panel to show. */
export function resolutionLabel(project: Project, resolution: ExportResolution): string {
  const { width, height } = exportDimensions({ ...project.export, resolution });
  return `${resolution} · ${width}×${height}`;
}

export { EXPORT_RESOLUTIONS };
