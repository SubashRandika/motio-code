import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteProjectAction = vi.fn<(projectId: string) => Promise<void>>(async () => {});
const push = vi.fn();

vi.mock("@/features/projects/actions", () => ({
  deleteProjectAction: (projectId: string) => deleteProjectAction(projectId),
  renameProjectAction: vi.fn(async () => ({})),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const { ProjectSettingsForm } = await import("@/features/projects/project-settings-form");

function setup() {
  render(<ProjectSettingsForm projectId="p1" projectName="Semantic Version Extractor" />);
  return userEvent.setup();
}

describe("deleting a project from its settings page", () => {
  beforeEach(() => {
    deleteProjectAction.mockClear();
    push.mockClear();
  });

  it("says what deleting costs before offering the button", () => {
    setup();
    expect(screen.getByText(/every scene in it will be removed/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("asks for confirmation rather than deleting on the first click", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));

    expect(deleteProjectAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete Semantic Version Extractor\?/)).toBeInTheDocument();
  });

  it("deletes the named project once confirmed, then leaves the dead page", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(screen.getByRole("button", { name: /Yes, delete it/ }));

    expect(deleteProjectAction).toHaveBeenCalledWith("p1");
    // The project this page describes no longer exists, so staying here would
    // render a 404.
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("backs out cleanly, leaving the project alone", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteProjectAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete project" })).toBeInTheDocument();
  });
});
