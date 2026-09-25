import Link from "next/link";

import type { ProjectSummary } from "@/core/model";
import { formatRelativeTime } from "@/lib/utils/format";

import { deleteProjectAction, duplicateProjectAction } from "./actions";
import { ProjectMenu } from "./project-menu";

const CONTENT_LABEL: Record<ProjectSummary["contentType"], string> = {
  code: "Code",
  diagram: "Diagram",
  infographic: "Infographic",
  mixed: "Mixed",
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const duplicate = duplicateProjectAction.bind(null, project.id);
  const remove = deleteProjectAction.bind(null, project.id);

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-panel border border-line bg-panel transition-colors duration-200 hover:border-line-strong">
      {/* Placeholder preview: the project's own canvas ratio and background.
          Replaced by a rendered thumbnail once export lands in Phase 4. */}
      <div
        className="canvas-grid flex items-center justify-center border-b border-line"
        style={{
          backgroundColor: project.canvas.background,
          aspectRatio: project.canvas.aspectRatio.replace(":", " / "),
          maxHeight: "11rem",
        }}
      >
        <span className="tabular rounded border border-line-strong bg-ink/70 px-2 py-1 text-[11px] text-mist">
          {project.canvas.width}×{project.canvas.height}
        </span>
      </div>

      <div className="flex flex-1 items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">
            {/* The overlay makes the whole card clickable while the menu stays on top. */}
            <Link href={`/projects/${project.id}/editor`} className="after:absolute after:inset-0">
              {project.name}
            </Link>
          </h3>

          <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-mist-dim">
            <span>{CONTENT_LABEL[project.contentType]}</span>
            <span aria-hidden="true">·</span>
            <span>
              {project.sceneCount} {project.sceneCount === 1 ? "scene" : "scenes"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{project.canvas.aspectRatio}</span>
          </p>

          <p className="mt-1 text-[11.5px] text-mist-dim">
            Edited {formatRelativeTime(project.updatedAt)}
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <ProjectMenu
            projectId={project.id}
            projectName={project.name}
            duplicate={duplicate}
            remove={remove}
          />
        </div>
      </div>
    </li>
  );
}
