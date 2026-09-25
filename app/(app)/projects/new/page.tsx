import Link from "next/link";
import type { Metadata } from "next";

import { PageHeading } from "@/components/ui/panel";
import { NewProjectForm } from "@/features/projects/new-project-form";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
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
        <NewProjectForm />
      </div>
    </div>
  );
}
