import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireUser } from "@/features/auth/session";
import { EditorShell } from "@/features/editor/editor-shell";
import { EditorStoreProvider } from "@/features/editor/store-provider";
import { loadProject } from "@/features/projects/queries";

export async function generateMetadata({
  params,
}: PageProps<"/projects/[projectId]/editor">): Promise<Metadata> {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await loadProject(projectId, user.id);
  return { title: project ? `${project.name} — Editor` : "Editor" };
}

export default async function EditorPage({ params }: PageProps<"/projects/[projectId]/editor">) {
  const { projectId } = await params;
  const user = await requireUser(`/projects/${projectId}/editor`);
  const project = await loadProject(projectId, user.id);

  // A project that belongs to someone else is indistinguishable from one that
  // does not exist, by design.
  if (!project) notFound();

  return (
    <EditorStoreProvider project={project}>
      <EditorShell />
    </EditorStoreProvider>
  );
}
