import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renameProjectAction =
  vi.fn<(previous: unknown, formData: FormData) => Promise<object>>(async () => ({}));

vi.mock("@/features/projects/actions", () => ({
  renameProjectAction: (previous: unknown, formData: FormData) =>
    renameProjectAction(previous, formData),
}));

const { ProjectMenu } = await import("@/features/projects/project-menu");

function setup() {
  const duplicate = vi.fn(async () => {});
  const remove = vi.fn(async () => {});

  render(
    <ProjectMenu
      projectId="p1"
      projectName="Semantic Version Extractor"
      duplicate={duplicate}
      remove={remove}
    />,
  );

  return { duplicate, remove, user: userEvent.setup() };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Actions for/ }));
}

describe("duplicating a project", () => {
  it("duplicates on the menu item, without a confirmation", async () => {
    // Duplicating is additive and cheap to undo by deleting the copy, so it does
    // not need the confirmation that deleting does.
    const { duplicate, user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Duplicate/ }));

    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the menu so the copy is not duplicated twice by accident", async () => {
    const { user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Duplicate/ }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("deleting a project from the dashboard", () => {
  beforeEach(() => {
    renameProjectAction.mockClear();
  });

  it("asks before deleting, naming the project", async () => {
    const { user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/Semantic Version Extractor/);
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  it("does not delete anything until the confirmation is accepted", async () => {
    const { remove, user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));

    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes once, when the confirmation is accepted", async () => {
    const { remove, user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));
    await user.click(screen.getByRole("button", { name: /Delete project/ }));

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("keeps the project when the confirmation is dismissed", async () => {
    const { remove, user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));
    await user.click(screen.getByRole("button", { name: /Keep it/ }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
