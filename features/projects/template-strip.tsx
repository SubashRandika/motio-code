import Link from "next/link";

import { TEMPLATES } from "@/core/templates";

/**
 * Starter templates on the dashboard.
 *
 * Chips rather than cards: ten preview cards would dominate a page whose job is
 * showing the user's own work. Each one deep-links into the creation flow with
 * itself already chosen, so picking a template is one click from here.
 */
export function TemplateStrip() {
  return (
    <section
      aria-labelledby="starter-templates"
      className="rounded-panel border border-line bg-panel p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="starter-templates" className="text-[13px] font-medium text-paper">
          Start from a template
        </h2>
        <p className="text-[12px] text-mist-dim">
          Editable scenes, not fixed videos. Change anything once it is open.
        </p>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <li key={template.id}>
            <Link
              href={`/projects/new?template=${template.id}`}
              title={template.description}
              className="block rounded border border-line bg-raised px-2.5 py-1.5 text-[12px] text-mist transition-colors hover:border-amber/60 hover:bg-amber-wash hover:text-paper"
            >
              {template.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
