import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { isCode } from "@/core/model";
import { PresetPicker } from "@/features/editor/properties/preset-picker";
import { createEditorStore } from "@/features/editor/store";

import { makeCodeElement, makeProject, makeScene, makeTextElement, renderWithStore } from "../fixtures";

const CODE = Array.from({ length: 8 }, (_, index) => `const v${index} = ${index};`).join("\n");

function setup(element = makeCodeElement({ content: { code: CODE } })) {
  const scene = makeScene({ data: { ...makeScene().data, elements: [element] } });
  const store = createEditorStore(makeProject({ scenes: [scene] }));

  act(() => store.getState().selectElement(element.id));
  renderWithStore(<PresetPicker element={element} />, store);

  const elements = () => store.getState().project.scenes[0].data.elements;
  return { store, elements, element };
}

describe("the preset picker", () => {
  it("lists the six presets with what each one does", () => {
    setup();

    expect(screen.getByRole("button", { name: /Typewriter reveal/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Line-by-line reveal/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Highlight and explain/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Code walkthrough/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Before and after/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sequential transformation/ })).toBeInTheDocument();
  });

  it("says that applying replaces what is there, before it does", () => {
    setup();
    expect(screen.getByText(/replaces this element's animations/)).toBeInTheDocument();
  });

  it("renders nothing for an element type it has no presets for", () => {
    const text = makeTextElement();
    const scene = makeScene({ data: { ...makeScene().data, elements: [text] } });
    const store = createEditorStore(makeProject({ scenes: [scene] }));

    const { container } = renderWithStore(<PresetPicker element={text} />, store);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("applying an element preset", () => {
  it("writes the animations onto the element", async () => {
    const user = userEvent.setup();
    const { elements } = setup();

    await user.click(screen.getByRole("button", { name: /Typewriter reveal/ }));

    const code = elements().filter(isCode)[0];
    expect(code.animations.map((animation) => animation.type)).toEqual(["reveal"]);
    expect(code.content.revealUnit).toBe("character");
  });

  it("replaces whatever was there rather than adding to it", async () => {
    const user = userEvent.setup();
    const { store, elements, element } = setup();

    act(() => store.getState().addAnimation(element.id, "slide"));
    expect(elements().filter(isCode)[0].animations).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Line-by-line reveal/ }));

    const types = elements().filter(isCode)[0].animations.map((animation) => animation.type);
    expect(types).toEqual(["fade", "reveal"]);
  });

  it("is one undo step", async () => {
    const user = userEvent.setup();
    const { store, elements } = setup();

    await user.click(screen.getByRole("button", { name: /Code walkthrough/ }));
    expect(elements().filter(isCode)[0].animations.length).toBeGreaterThan(1);

    act(() => store.getState().undo());
    expect(elements().filter(isCode)[0].animations).toEqual([]);
  });

  it("names the step so undo can be labelled", async () => {
    const user = userEvent.setup();
    const { store } = setup();

    await user.click(screen.getByRole("button", { name: /Typewriter reveal/ }));
    expect(store.getState().history.past.at(-1)?.label).toBe("Apply Typewriter reveal");
  });

  it("marks the project dirty so it will be saved", async () => {
    const user = userEvent.setup();
    const { store } = setup();

    await user.click(screen.getByRole("button", { name: /Typewriter reveal/ }));
    expect(store.getState().status).toBe("dirty");
  });
});

describe("applying a scene preset", () => {
  it("splits the panel into two and keeps the rest of the scene", async () => {
    const user = userEvent.setup();
    const element = makeCodeElement({ content: { code: CODE } });
    const caption = makeTextElement({ id: "el_caption", layer: 1 });
    const scene = makeScene({ data: { ...makeScene().data, elements: [element, caption] } });
    const store = createEditorStore(makeProject({ scenes: [scene] }));

    renderWithStore(<PresetPicker element={element} />, store);
    await user.click(screen.getByRole("button", { name: /Before and after/ }));

    const elements = store.getState().project.scenes[0].data.elements;
    expect(elements.filter(isCode)).toHaveLength(2);
    expect(elements.some((item) => item.id === "el_caption")).toBe(true);
  });

  it("renumbers the layers so nothing shares one", async () => {
    const user = userEvent.setup();
    const { elements } = setup();

    await user.click(screen.getByRole("button", { name: /Sequential transformation/ }));

    const layers = elements().map((item) => item.layer);
    expect(new Set(layers).size).toBe(layers.length);
    expect([...layers].sort((a, b) => a - b)).toEqual(layers);
  });

  it("clears the selection, because the element it pointed at is gone", async () => {
    const user = userEvent.setup();
    const { store } = setup();

    await user.click(screen.getByRole("button", { name: /Before and after/ }));
    expect(store.getState().selectedElementIds).toEqual([]);
  });

  it("undoes back to the single panel in one step", async () => {
    const user = userEvent.setup();
    const { store, elements } = setup();

    await user.click(screen.getByRole("button", { name: /Before and after/ }));
    expect(elements().filter(isCode)).toHaveLength(2);

    act(() => store.getState().undo());
    expect(elements().filter(isCode)).toHaveLength(1);
  });
});
