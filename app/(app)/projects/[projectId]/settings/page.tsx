import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Panel, PageHeading } from "@/components/ui/panel";
import { requireUser } from "@/features/auth/session";
import { ExportHistory } from "@/features/export/export-history";
import { listRenderJobs } from "@/features/export/queries";
import { ProjectSettingsForm } from "@/features/projects/project-settings-form";
import { loadProject } from "@/features/projects/queries";
import { formatRelativeTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({
  params,
}: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  const user = await requireUser(`/projects/${projectId}/settings`);
  const project = await loadProject(projectId, user.id);

  if (!project) notFound();

  const renders = await listRenderJobs(projectId, user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href={`/projects/${project.id}/editor`} className="text-[13px] text-mist hover:text-paper">
        ← Back to the editor
      </Link>

      <div className="mt-4">
        <PageHeading title="Project settings" description={project.name} />
      </div>

      <Panel className="mt-6 p-5">
        <ProjectSettingsForm projectId={project.id} projectName={project.name} />
      </Panel>

      <Panel className="mt-4 p-5">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
          Exports
        </h2>
        <div className="mt-3">
          <ExportHistory jobs={renders} />
        </div>
      </Panel>

      <Panel className="mt-4 p-5">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
          Details
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
          <Detail label="Scenes" value={String(project.scenes.length)} />
          <Detail label="Canvas" value={`${project.canvas.width}×${project.canvas.height}`} />
          <Detail label="Frame rate" value={`${project.canvas.fps} fps`} />
          <Detail label="Content" value={project.contentType} />
          <Detail label="Created" value={formatRelativeTime(project.createdAt)} />
          <Detail label="Edited" value={formatRelativeTime(project.updatedAt)} />
        </dl>
      </Panel>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-mist-dim">{label}</dt>
      <dd className="tabular mt-0.5 text-paper">{value}</dd>
    </div>
  );
}
