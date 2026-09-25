import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SceneList } from "@/features/editor/scene-list";
import { EditorStoreProvider } from "@/features/editor/store-provider";

import { makeProject } from "../fixtures";

function renderSceneList(onSelectScene = vi.fn()) {
  const project = makeProject();
  render(
    <EditorStoreProvider project={project}>
      <SceneList onSelectScene={onSelectScene} />
    </EditorStoreProvider>,
  );
  return { project, onSelectScene };
}

function sceneNames() {
  return screen
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByRole("button")[0].textContent ?? "");
}

describe("SceneList", () => {
  it("lists the project's scenes in order", () => {
    renderSceneList();
    const names = sceneNames();
    expect(names[0]).toContain("Opening");
    expect(names[1]).toContain("The check");
  });

  it("shows each scene's duration and element count", () => {
    renderSceneList();
    // 150 frames at 30fps.
    expect(screen.getByText(/0:05 · 0 elements/)).toBeInTheDocument();
  });

  it("reports the selected scene to its parent", async () => {
    const user = userEvent.setup();
    const { onSelectScene, project } = renderSceneList();

    await user.click(screen.getByText("The check"));
    expect(onSelectScene).toHaveBeenCalledWith(project.scenes[1].id);
  });

  it("adds a scene", async () => {
    const user = userEvent.setup();
    renderSceneList();

    await user.click(screen.getByRole("button", { name: "Add a scene" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Scene 3")).toBeInTheDocument();
  });

  it("duplicates a scene next to the original", async () => {
    const user = userEvent.setup();
    renderSceneList();

    await user.click(screen.getByRole("button", { name: "Duplicate Opening" }));

    const names = sceneNames();
    expect(names[0]).toContain("Opening");
    expect(names[1]).toContain("Opening copy");
    expect(names[2]).toContain("The check");
  });

  it("deletes a scene", async () => {
    const user = userEvent.setup();
    renderSceneList();

    await user.click(screen.getByRole("button", { name: "Delete Opening" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Opening")).not.toBeInTheDocument();
  });

  it("refuses to delete the last remaining scene", async () => {
    const user = userEvent.setup();
    renderSceneList();

    await user.click(screen.getByRole("button", { name: "Delete Opening" }));
    expect(screen.getByRole("button", { name: "Delete The check" })).toBeDisabled();
  });

  it("reorders scenes and renumbers them", async () => {
    const user = userEvent.setup();
    renderSceneList();

    await user.click(screen.getByRole("button", { name: "Move The check up" }));

    const names = sceneNames();
    expect(names[0]).toContain("01");
    expect(names[0]).toContain("The check");
    expect(names[1]).toContain("02");
    expect(names[1]).toContain("Opening");
  });

  it("disables moves at the ends of the list", () => {
    renderSceneList();
    expect(screen.getByRole("button", { name: "Move Opening up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move The check down" })).toBeDisabled();
  });
});
