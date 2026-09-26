import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { templatesFor } from "@/core/templates";

// The form posts to a server action, which cannot run in jsdom. Stubbing it
// keeps these tests about the picker's behaviour rather than about Next.
vi.mock("@/features/projects/actions", () => ({
  createProjectAction: vi.fn(async () => ({})),
}));

const { NewProjectForm } = await import("@/features/projects/new-project-form");

function radioFor(name: string): HTMLInputElement {
  return screen.getByRole("radio", { name: new RegExp(name) }) as HTMLInputElement;
}

/**
 * Content types are chosen by their hint, not their label: "Code" is the start
 * of a content type's name *and* of a template's, so the label alone is
 * ambiguous.
 */
const CONTENT_HINTS = {
  code: "Snippets, walkthroughs",
  diagram: "Architecture, flows",
  infographic: "Counters, charts",
  mixed: "A bit of everything",
} as const;

function chooseContentType(contentType: keyof typeof CONTENT_HINTS): HTMLInputElement {
  return radioFor(CONTENT_HINTS[contentType]);
}

describe("the starter template picker", () => {
  it("starts on a blank project, so creating one needs no extra choice", () => {
    render(<NewProjectForm />);
    expect(radioFor("Blank project").checked).toBe(true);
  });

  it("offers the templates for the chosen content type", () => {
    render(<NewProjectForm />);

    // "Code" is the default content type.
    for (const template of templatesFor("code")) {
      expect(screen.getByRole("radio", { name: new RegExp(template.name) })).toBeInTheDocument();
    }

    expect(screen.queryByRole("radio", { name: /Data pipeline/ })).not.toBeInTheDocument();
  });

  it("swaps the list when the content type changes", async () => {
    const user = userEvent.setup();
    render(<NewProjectForm />);

    await user.click(chooseContentType("diagram"));

    expect(screen.getByRole("radio", { name: /Data pipeline/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Code walkthrough/ })).not.toBeInTheDocument();
  });

  it("selects a template and submits its id", async () => {
    const user = userEvent.setup();
    render(<NewProjectForm />);

    await user.click(radioFor("Code walkthrough"));

    const selected = radioFor("Code walkthrough");
    expect(selected.checked).toBe(true);
    expect(selected.value).toBe("code-walkthrough");
  });

  it("submits an empty id for a blank project", () => {
    render(<NewProjectForm />);
    expect(radioFor("Blank project").value).toBe("");
  });

  it("falls back to blank when the chosen template is no longer on offer", async () => {
    const user = userEvent.setup();
    render(<NewProjectForm />);

    await user.click(radioFor("Code walkthrough"));
    expect(radioFor("Code walkthrough").checked).toBe(true);

    // Switching content type takes that template off the list entirely.
    await user.click(chooseContentType("infographic"));

    expect(radioFor("Blank project").checked).toBe(true);
    expect(screen.queryByRole("radio", { name: /Code walkthrough/ })).not.toBeInTheDocument();
  });

  it("offers something for every content type, so no choice is a dead end", async () => {
    const user = userEvent.setup();
    render(<NewProjectForm />);

    for (const contentType of ["code", "diagram", "infographic", "mixed"] as const) {
      await user.click(chooseContentType(contentType));

      for (const template of templatesFor(contentType)) {
        expect(
          screen.getByRole("radio", { name: new RegExp(template.name) }),
          template.id,
        ).toBeInTheDocument();
      }
    }
  });

  it("says that a template is a starting point, not a fixed video", () => {
    render(<NewProjectForm />);
    expect(screen.getByText(/Nothing in one is fixed/)).toBeInTheDocument();
  });
});

describe("arriving from a template link", () => {
  it("opens with that template chosen and its content type selected", () => {
    render(<NewProjectForm initialTemplateId="data-pipeline" initialContentType="diagram" />);

    expect(radioFor("Data pipeline").checked).toBe(true);
    expect(chooseContentType("diagram").checked).toBe(true);
    expect(radioFor("Blank project").checked).toBe(false);
  });

  it("falls back to blank for a template id that no longer exists", () => {
    render(<NewProjectForm initialTemplateId="retired-template" />);
    expect(radioFor("Blank project").checked).toBe(true);
  });

  it("can still be changed once it is open", async () => {
    const user = userEvent.setup();
    render(<NewProjectForm initialTemplateId="data-pipeline" initialContentType="diagram" />);

    await user.click(radioFor("Blank project"));
    expect(radioFor("Blank project").checked).toBe(true);
    expect(radioFor("Data pipeline").checked).toBe(false);
  });
});
