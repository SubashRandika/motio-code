import { Search } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeading } from "@/components/ui/panel";
import { requireUser } from "@/features/auth/session";
import { ProjectCard } from "@/features/projects/project-card";
import { listProjects } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Projects" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const projects = await listProjects(user.id, query);

  const firstName = user.displayName?.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading
        title={firstName ? `Projects, ${firstName}` : "Projects"}
        description="Everything you are building. Open one to pick up where you left off."
        action={<ButtonLink href="/projects/new">New project</ButtonLink>}
      />

      <form role="search" className="mt-6 max-w-sm">
        <label htmlFor="project-search" className="sr-only">
          Search projects by name
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist-dim"
            aria-hidden="true"
          />
          <input
            id="project-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search projects"
            className="h-10 w-full rounded-md border border-line bg-ink-sunk pr-3 pl-9 text-sm text-paper placeholder:text-mist-dim hover:border-line-strong focus:border-amber focus:outline-none"
          />
        </div>
      </form>

      <div className="mt-6">
        {projects.length === 0 ? (
          query ? (
            <EmptyState
              title="No projects match that search"
              description={`Nothing is named like "${query}". Try a shorter search, or clear it to see everything.`}
              action={
                <ButtonLink href="/dashboard" variant="secondary">
                  Clear search
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title="Nothing here yet"
              description="Start with a blank canvas, pick an aspect ratio, and add your first scene. You can change all of it later."
              action={<ButtonLink href="/projects/new">Create your first project</ButtonLink>}
            />
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
