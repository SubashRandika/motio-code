import { Check, CircleSlash, Clock, TriangleAlert } from "lucide-react";

import type { RenderStatus } from "@/core/render";
import { formatRelativeTime } from "@/lib/utils/format";

import type { RenderJobSummary } from "./queries";

const STATUS_LABEL: Record<RenderStatus, string> = {
  queued: "Queued",
  processing: "Interrupted",
  completed: "Exported",
  failed: "Failed",
  cancelled: "Cancelled",
};

function StatusIcon({ status }: { status: RenderStatus }) {
  const className = "size-3.5 shrink-0";

  switch (status) {
    case "completed":
      return <Check className={`${className} text-ok`} aria-hidden="true" />;
    case "failed":
      return <TriangleAlert className={`${className} text-danger`} aria-hidden="true" />;
    case "cancelled":
      return <CircleSlash className={`${className} text-mist-dim`} aria-hidden="true" />;
    default:
      return <Clock className={`${className} text-mist-dim`} aria-hidden="true" />;
  }
}

/**
 * What has been exported from this project.
 *
 * Exports are rendered in the browser and handed straight to the user, so there
 * is no stored file to offer again — this is a record of what was produced, not a
 * file list. A job still marked `processing` is one whose tab went away before it
 * could report back, which is why it reads "Interrupted" rather than a status
 * that suggests something is still running.
 */
export function ExportHistory({ jobs }: { jobs: RenderJobSummary[] }) {
  if (jobs.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-mist">
        Nothing exported yet. Open the editor and press Preview to render a video.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
          <span className="mt-0.5">
            <StatusIcon status={job.status} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-paper">
              {STATUS_LABEL[job.status]}
              {job.settings ? (
                <span className="tabular text-[11.5px] text-mist-dim">
                  {job.settings.format.toUpperCase()} · {job.settings.resolution} ·{" "}
                  {job.settings.fps} fps · {job.settings.aspectRatio}
                </span>
              ) : null}
            </p>

            <p className="mt-0.5 text-[11.5px] text-mist-dim">
              {formatRelativeTime(job.completedAt ?? job.createdAt)}
            </p>

            {job.errorMessage ? (
              <p className="mt-1 text-[11.5px] leading-relaxed text-danger">{job.errorMessage}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
