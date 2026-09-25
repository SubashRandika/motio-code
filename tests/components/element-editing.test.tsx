import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ElementRail, LayerList } from "@/features/editor/element-panel";
import { PropertiesPanel } from "@/features/editor/properties-panel";
import { createEditorStore } from "@/features/editor/store";

import { makeProject, makeTextElement, renderWithStore } from "../fixtures";

function storeWith(elements = [makeTextElement()]) {
  const project = makeProject();
  project.scenes[0].data.elements = elements;
  return createEditorStore(project);
}

function elementsOf(store: ReturnType<typeof createEditorStore>) {
  return store.getState().project.scenes[0].data.elements;
}

describe("ElementRail", () => {
  it("offers one button per element type", () => {
    renderWithStore(<ElementRail />, createEditorStore(makeProject()));

    for (const label of ["Text", "Code", "Shape", "Callout", "Image"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("adds an element and selects it", async () => {
    const user = userEvent.setup();
    const store = createEditorStore(makeProject());
    renderWithStore(<ElementRail />, store);

    await user.click(screen.getByRole("button", { name: "Text" }));

    const elements = elementsOf(store);
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe("text");
    expect(store.getState().selectedElementIds).toEqual([elements[0].id]);
  });

  it("places a new element inside the canvas", async () => {
    const user = userEvent.setup();
    const store = createEditorStore(makeProject());
    renderWithStore(<ElementRail />, store);

    await user.click(screen.getByRole("button", { name: "Code" }));

    const { rect } = elementsOf(store)[0];
    const { canvas } = store.getState().project;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(canvas.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(canvas.height);
  });

  it("records each addition as its own undo step", async () => {
    const user = userEvent.setup();
    const store = createEditorStore(makeProject());
    renderWithStore(<ElementRail />, store);

    await user.click(screen.getByRole("button", { name: "Text" }));
    await user.click(screen.getByRole("button", { name: "Shape" }));
    expect(elementsOf(store)).toHaveLength(2);

    store.getState().undo();
    expect(elementsOf(store)).toHaveLength(1);

    store.getState().undo();
    expect(elementsOf(store)).toHaveLength(0);
  });
});

describe("LayerList", () => {
  const elements = [
    makeTextElement({ id: "el_1", name: "Background", layer: 0 }),
    makeTextElement({ id: "el_2", name: "Heading", layer: 1 }),
  ];

  it("lists the top of the stack first", () => {
    renderWithStore(<LayerList />, storeWith(elements));

    const names = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(names[0]).toContain("Heading");
    expect(names[1]).toContain("Background");
  });

  it("selects one element, and adds to the selection with shift", async () => {
    const user = userEvent.setup();
    const store = storeWith(elements);
    renderWithStore(<LayerList />, store);

    await user.click(screen.getByRole("button", { name: "Heading" }));
    expect(store.getState().selectedElementIds).toEqual(["el_2"]);

    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: "Background" }));
    await user.keyboard("{/Shift}");
    expect(store.getState().selectedElementIds).toEqual(["el_2", "el_1"]);
  });

  it("hides and shows an element", async () => {
    const user = userEvent.setup();
    const store = storeWith(elements);
    renderWithStore(<LayerList />, store);

    await user.click(screen.getByRole("button", { name: "Hide Heading" }));
    expect(elementsOf(store).find((el) => el.id === "el_2")?.hidden).toBe(true);

    await user.click(screen.getByRole("button", { name: "Show Heading" }));
    expect(elementsOf(store).find((el) => el.id === "el_2")?.hidden).toBe(false);
  });

  it("locks an element", async () => {
    const user = userEvent.setup();
    const store = storeWith(elements);
    renderWithStore(<LayerList />, store);

    await user.click(screen.getByRole("button", { name: "Lock Heading" }));
    expect(elementsOf(store).find((el) => el.id === "el_2")?.locked).toBe(true);
  });

  it("reorders the stack", async () => {
    const user = userEvent.setup();
    const store = storeWith(elements);
    renderWithStore(<LayerList />, store);

    await user.click(screen.getByRole("button", { name: "Move Background up" }));

    const byId = new Map(elementsOf(store).map((el) => [el.id, el.layer]));
    expect(byId.get("el_1")).toBe(1);
    expect(byId.get("el_2")).toBe(0);
  });

  it("disables the moves that would go off either end", () => {
    renderWithStore(<LayerList />, storeWith(elements));
    expect(screen.getByRole("button", { name: "Move Heading up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Background down" })).toBeDisabled();
  });

  it("says so when the scene is empty", () => {
    renderWithStore(<LayerList />, storeWith([]));
    expect(screen.getByText("Nothing in this scene yet.")).toBeInTheDocument();
  });
});

describe("PropertiesPanel", () => {
  it("shows scene properties when nothing is selected", () => {
    renderWithStore(<PropertiesPanel />, storeWith());
    expect(screen.getByRole("heading", { name: "Scene" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Opening");
  });

  it("shows the selected element's box and timing", () => {
    const store = storeWith([makeTextElement({ from: 12, durationInFrames: 40 })]);
    store.getState().selectElement("el_1");
    renderWithStore(<PropertiesPanel />, store);

    expect(screen.getByLabelText("X")).toHaveValue(100);
    expect(screen.getByLabelText("Y")).toHaveValue(100);
    expect(screen.getByLabelText("Width")).toHaveValue(400);
    expect(screen.getByLabelText("Starts at")).toHaveValue(12);
  });

  it("writes a position change back to the element", async () => {
    const user = userEvent.setup();
    const store = storeWith();
    store.getState().selectElement("el_1");
    renderWithStore(<PropertiesPanel />, store);

    const x = screen.getByLabelText("X");
    await user.clear(x);
    await user.type(x, "250");

    expect(elementsOf(store)[0].rect.x).toBe(250);
  });

  it("collapses a run of typing into one undo step", async () => {
    const user = userEvent.setup();
    const store = storeWith();
    store.getState().selectElement("el_1");
    renderWithStore(<PropertiesPanel />, store);

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Title");

    expect(elementsOf(store)[0].name).toBe("Title");
    expect(store.getState().history.past).toHaveLength(1);

    store.getState().undo();
    expect(elementsOf(store)[0].name).toBe("Text");
  });

  it("switches an element between a fixed length and the rest of the scene", async () => {
    const user = userEvent.setup();
    const store = storeWith([makeTextElement({ from: 10, durationInFrames: null })]);
    store.getState().selectElement("el_1");
    renderWithStore(<PropertiesPanel />, store);

    const toggle = screen.getByLabelText("Runs to the end of the scene");
    expect(toggle).toBeChecked();

    await user.click(toggle);
    // The scene is 150 frames and the element starts at 10.
    expect(elementsOf(store)[0].durationInFrames).toBe(140);
  });

  it("adds and removes an animation", async () => {
    const user = userEvent.setup();
    const store = storeWith();
    store.getState().selectElement("el_1");
    renderWithStore(<PropertiesPanel />, store);

    expect(screen.getByText(/No animation yet/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Add an animation"), "fade");
    expect(elementsOf(store)[0].animations).toHaveLength(1);
    expect(elementsOf(store)[0].animations[0].type).toBe("fade");

    await user.click(screen.getByRole("button", { name: "Remove Fade animation" }));
    expect(elementsOf(store)[0].animations).toHaveLength(0);
  });

  it("offers alignment only when several elements are selected", async () => {
    const user = userEvent.setup();
    const store = storeWith([
      makeTextElement({ id: "el_1", rect: { x: 0, y: 0, width: 100, height: 50 } }),
      makeTextElement({ id: "el_2", rect: { x: 300, y: 200, width: 100, height: 50 } }),
    ]);

    store.getState().selectElements(["el_1", "el_2"]);
    renderWithStore(<PropertiesPanel />, store);

    expect(screen.getByRole("heading", { name: "2 elements selected" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Align left" }));
    expect(elementsOf(store).map((el) => el.rect.x)).toEqual([0, 0]);
  });
});
