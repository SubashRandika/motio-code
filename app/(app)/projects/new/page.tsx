import Link from "next/link";
import type { Metadata } from "next";

import { PageHeading } from "@/components/ui/panel";
import { findTemplate } from "@/core/templates";
import { NewProjectForm } from "@/features/projects/new-project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const params = await searchParams;

  // Arriving from a template chip on the dashboard. An id the catalogue no
  // longer knows just means no template is preselected.
  const template =
    typeof params.template === "string" ? findTemplate(params.template) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/dashboard" className="text-[13px] text-mist hover:text-paper">
        ← Back to projects
      </Link>

      <div className="mt-4">
        <PageHeading
          title="New project"
          description="Name it, choose what you are explaining and pick a canvas. Everything here can change later."
        />
      </div>

      <div className="mt-8">
        <NewProjectForm
          initialTemplateId={template?.id ?? ""}
          initialContentType={template?.contentType}
        />
      </div>
    </div>
  );
}
