"use client";

import { AlertTriangle, Check, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Project } from "@/core/model";
import { webRenderTarget } from "@/core/render";

import { useWebRender } from "./use-web-render";

/** "about 40s", not "39.7s": the estimate is not that good and should not pretend. */
function roughly(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds < 10) return "a few seconds left";
  if (seconds < 90) return `about ${Math.round(seconds / 5) * 5}s left`;
  return `about ${Math.round(seconds / 60)} min left`;
}

export function ExportControls({ project }: { project: Project }) {
  const render = useWebRender(project);
  const target = webRenderTarget(project.export.format);
  const busy = render.phase === "preparing" || render.phase === "rendering";

  if (!target) {
    return (
      <div className="rounded-md border border-line bg-raised px-3 py-2.5">
        <p className="text-[12.5px] leading-relaxed text-mist">
          <span className="text-paper">{project.export.format.toUpperCase()}</span> cannot be
          encoded in the browser. Switch the format to MP4 or WebM to export now — GIF arrives with
          server-side rendering.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-raised px-3 py-3">
      {/* A render takes minutes and its only other signal is a moving bar, which
          announces nothing. Milestones only: a percentage read aloud several
          times a second would make the tab unusable. The failure case is left to
          the `role="alert"` at the bottom. */}
      <p role="status" className="sr-only">
        {render.phase === "rendering"
          ? "Rendering started. This tab must stay open."
          : render.phase === "done"
            ? `Export finished. ${render.fileName ?? "The video"} was saved to your downloads.`
            : render.phase === "cancelled"
              ? "Export cancelled. Nothing was saved."
              : ""}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-paper">
            {busy ? "Rendering in this tab" : "Export video"}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-mist-dim">
            {busy
              ? "Keep this tab visible — a background tab renders more slowly."
              : `Rendered here in your browser, then saved as ${project.export.format.toUpperCase()}.`}
          </p>
        </div>

        {busy ? (
          <Button variant="secondary" size="sm" onClick={render.cancel}>
            Cancel
          </Button>
        ) : (
          <Button size="sm" onClick={() => void render.start()}>
            {render.phase === "done" || render.phase === "error" ? (
              "Export again"
            ) : (
              <>
                <Download className="size-3.5" />
                Export video
              </>
            )}
          </Button>
        )}
      </div>

      {busy ? (
        <div>
          <div
            role="progressbar"
            aria-label="Render progress"
            aria-valuenow={Math.round(render.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-ink-sunk"
          >
            <div
              className="h-full rounded-full bg-amber transition-[width] duration-200"
              style={{ width: `${Math.max(2, render.progress * 100)}%` }}
            />
          </div>

          <p className="tabular mt-1.5 flex items-center gap-2 text-[11.5px] text-mist-dim">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            {render.phase === "preparing"
              ? "Preparing…"
              : `${Math.round(render.progress * 100)}%`}
            {roughly(render.remainingMs) ? <span>· {roughly(render.remainingMs)}</span> : null}
          </p>
        </div>
      ) : null}

      {render.phase === "done" ? (
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-mist">
          <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden="true" />
          <span>
            Saved <span className="text-paper">{render.fileName}</span> to your downloads.
          </span>
        </p>
      ) : null}

      {render.phase === "cancelled" ? (
        <p className="text-[12px] text-mist-dim">Export cancelled. Nothing was saved.</p>
      ) : null}

      {render.phase === "error" && render.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-[12px] leading-relaxed text-danger"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{render.error}</span>
        </p>
      ) : null}
    </div>
  );
}
