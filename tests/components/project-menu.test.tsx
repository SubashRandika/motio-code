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

/**
 * A `role="menu"` is a promise: a screen reader tells the user it is a menu, and
 * they then expect the arrow keys to work and Escape to put them back where they
 * were. Getting the role right and the keyboard wrong is worse than using plain
 * buttons, because the announcement sets an expectation the widget breaks.
 */
describe("reaching the menu without a pointer", () => {
  function trigger() {
    return screen.getByRole("button", { name: /Actions for/ });
  }

  it("opens on ArrowDown and lands on the first item", async () => {
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus();
  });

  it("opens on ArrowUp at the bottom of the list, which is what ArrowUp means", async () => {
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveFocus();
  });

  it("moves through the items with the arrow keys, and wraps", async () => {
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Duplicate/ })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveFocus();

    // Wrapping matters: without it the last item is a dead end and the only way
    // back is to guess that Escape and re-open will work.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveFocus();
  });

  it("jumps to the ends with Home and End", async () => {
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}{End}");
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: /Rename/ })).toHaveFocus();
  });

  it("closes on Escape and gives focus back to the trigger", async () => {
    // Focus has to go somewhere deliberate. If it is left on the item that is
    // being unmounted, the browser resets it to <body> and a keyboard user is
    // dropped at the top of the dashboard with no idea which project they were on.
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("closes on Tab rather than trapping focus inside it", async () => {
    const { user } = setup();
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await user.tab();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("the dialogs the menu opens", () => {
  it("names the dialog, so it is not announced as an unlabelled one", async () => {
    const { user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));

    // A native <dialog> takes no name from the heading inside it.
    expect(screen.getByRole("dialog", { name: "Delete project" })).toBeInTheDocument();
  });

  it("returns focus to the trigger when the confirmation is dismissed", async () => {
    // The menu item that opened this dialog no longer exists, so the browser's
    // own focus restoration has nothing to restore to.
    const { user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));
    await user.click(screen.getByRole("button", { name: /Keep it/ }));

    expect(screen.getByRole("button", { name: /Actions for/ })).toHaveFocus();
  });

  it("returns focus to the trigger after a rename is cancelled", async () => {
    const { user } = setup();
    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /Rename/ }));
    expect(screen.getByRole("dialog", { name: "Rename project" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.getByRole("button", { name: /Actions for/ })).toHaveFocus();
  });
});
