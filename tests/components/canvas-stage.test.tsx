import { act, fireEvent, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTimeline } from "@/core/animation";
import { CanvasStage } from "@/features/editor/canvas-stage";
import { createEditorStore } from "@/features/editor/store";

import { makeProject, makeTextElement, renderWithStore } from "../fixtures";

/**
 * jsdom has no layout. These bounds make the stage's fit-to-container maths
 * land on exactly 0.5, so one screen pixel is two canvas units and the
 * assertions below read as plain arithmetic.
 */
const STUB_BOX = { left: 0, top: 0, width: 1016, height: 596, right: 1016, bottom: 596, x: 0, y: 0 };

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = () => STUB_BOX as DOMRect;
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

function setup(elements = [makeTextElement()]) {
  const project = makeProject();
  project.scenes[0].data.elements = elements;
  const store = createEditorStore(project);
  const timeline = buildTimeline(project.scenes);

  renderWithStore(<CanvasStage project={project} timeline={timeline} frame={0} />, store);

  const stage = document.querySelector<HTMLElement>("[data-canvas-stage]");
  const element = (id = "el_1") => document.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
  const rectOf = (id = "el_1") =>
    store.getState().project.scenes[0].data.elements.find((el) => el.id === id)!.rect;

  return { store, stage, element, rectOf };
}

function drag(target: Element, fromX: number, toX: number, fromY = 0, toY = 0, init = {}) {
  fireEvent.pointerDown(target, { clientX: fromX, clientY: fromY, pointerId: 1, button: 0, ...init });
  fireEvent.pointerMove(target, { clientX: toX, clientY: toY, pointerId: 1, ...init });
  fireEvent.pointerUp(target, { clientX: toX, clientY: toY, pointerId: 1, ...init });
}

describe("CanvasStage selection", () => {
  it("selects the element under the pointer", () => {
    const { store, element } = setup();

    fireEvent.pointerDown(element()!, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerUp(element()!, { clientX: 100, clientY: 100, pointerId: 1 });

    expect(store.getState().selectedElementIds).toEqual(["el_1"]);
  });

  it("adds to the selection with shift", () => {
    const elements = [
      makeTextElement({ id: "el_1" }),
      makeTextElement({ id: "el_2", rect: { x: 800, y: 100, width: 200, height: 100 } }),
    ];
    const { store, element } = setup(elements);

    fireEvent.pointerDown(element("el_1")!, { clientX: 60, clientY: 60, pointerId: 1, button: 0 });
    fireEvent.pointerUp(element("el_1")!, { clientX: 60, clientY: 60, pointerId: 1 });

    fireEvent.pointerDown(element("el_2")!, {
      clientX: 420,
      clientY: 60,
      pointerId: 2,
      button: 0,
      shiftKey: true,
    });
    fireEvent.pointerUp(element("el_2")!, { clientX: 420, clientY: 60, pointerId: 2 });

    expect(store.getState().selectedElementIds).toEqual(["el_1", "el_2"]);
  });

  it("clears the selection when the backdrop is clicked", () => {
    const { store, stage } = setup();
    act(() => store.getState().selectElement("el_1"));

    fireEvent.pointerDown(stage!, { clientX: 900, clientY: 500, pointerId: 1, button: 0 });
    fireEvent.pointerUp(stage!, { clientX: 900, clientY: 500, pointerId: 1 });

    expect(store.getState().selectedElementIds).toEqual([]);
  });

  it("selects everything a marquee touches", () => {
    const elements = [
      makeTextElement({ id: "el_1", rect: { x: 100, y: 100, width: 200, height: 100 } }),
      makeTextElement({ id: "el_2", rect: { x: 1500, y: 800, width: 200, height: 100 } }),
    ];
    const { store, stage } = setup(elements);

    // 0,0 -> 400,300 in screen pixels is 0,0 -> 800,600 in canvas units,
    // which covers the first element but not the second.
    drag(stage!, 0, 400, 0, 300);

    expect(store.getState().selectedElementIds).toEqual(["el_1"]);
  });

  it("ignores a locked element and starts a marquee instead", () => {
    const { store, element } = setup([makeTextElement({ locked: true })]);

    fireEvent.pointerDown(element()!, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerUp(element()!, { clientX: 100, clientY: 100, pointerId: 1 });

    expect(store.getState().selectedElementIds).toEqual([]);
  });
});

describe("CanvasStage dragging", () => {
  it("moves an element by the pointer delta in canvas units", () => {
    const { element, rectOf } = setup();

    // 100 screen pixels at 0.5 scale is 200 canvas units.
    drag(element()!, 100, 200, 100, 100, { altKey: true });

    expect(rectOf().x).toBe(300);
    expect(rectOf().y).toBe(100);
  });

  it("snaps the element's centre to the canvas centre", () => {
    const { element, rectOf } = setup();

    // Lands the centre on 956, four units short of the 960 canvas centre.
    drag(element()!, 0, 328, 0, 0);

    expect(rectOf().x).toBe(760);
    expect(rectOf().x + rectOf().width / 2).toBe(960);
  });

  it("lets alt turn snapping off", () => {
    const { element, rectOf } = setup();

    drag(element()!, 0, 328, 0, 0, { altKey: true });

    expect(rectOf().x).toBe(756);
  });

  it("moves every selected element together", () => {
    const elements = [
      makeTextElement({ id: "el_1", rect: { x: 100, y: 100, width: 200, height: 100 } }),
      makeTextElement({ id: "el_2", rect: { x: 600, y: 400, width: 200, height: 100 } }),
    ];
    const { store, element, rectOf } = setup(elements);
    act(() => store.getState().selectElements(["el_1", "el_2"]));

    drag(element("el_1")!, 0, 50, 0, 0, { altKey: true });

    expect(rectOf("el_1").x).toBe(200);
    expect(rectOf("el_2").x).toBe(700);
  });

  it("keeps a whole drag as one undo step", () => {
    const { store, element, rectOf } = setup();

    fireEvent.pointerDown(element()!, { clientX: 0, clientY: 0, pointerId: 1, button: 0, altKey: true });
    fireEvent.pointerMove(element()!, { clientX: 20, clientY: 0, pointerId: 1, altKey: true });
    fireEvent.pointerMove(element()!, { clientX: 60, clientY: 0, pointerId: 1, altKey: true });
    fireEvent.pointerMove(element()!, { clientX: 100, clientY: 0, pointerId: 1, altKey: true });
    fireEvent.pointerUp(element()!, { clientX: 100, clientY: 0, pointerId: 1 });

    expect(rectOf().x).toBe(300);
    expect(store.getState().history.past).toHaveLength(1);

    act(() => store.getState().undo());
    expect(rectOf().x).toBe(100);
  });
});

describe("CanvasStage resizing", () => {
  it("shows eight handles for a single selection", () => {
    const { store } = setup();
    act(() => store.getState().selectElement("el_1"));

    expect(document.querySelectorAll("[data-resize-handle]")).toHaveLength(8);
  });

  it("shows no handles for a multi-selection", () => {
    const elements = [makeTextElement({ id: "el_1" }), makeTextElement({ id: "el_2" })];
    const { store } = setup(elements);
    act(() => store.getState().selectElements(["el_1", "el_2"]));

    expect(document.querySelectorAll("[data-resize-handle]")).toHaveLength(0);
  });

  it("grows the element from the east handle without moving its left edge", () => {
    const { store, stage, rectOf } = setup();
    act(() => store.getState().selectElement("el_1"));

    const handle = document.querySelector('[data-resize-handle="e"]')!;
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1, button: 0 });
    fireEvent.pointerMove(stage!, { clientX: 50, clientY: 0, pointerId: 1, altKey: true });
    fireEvent.pointerUp(stage!, { clientX: 50, clientY: 0, pointerId: 1 });

    expect(rectOf().x).toBe(100);
    expect(rectOf().width).toBe(500);
  });
});

describe("CanvasStage empty state", () => {
  it("tells the user where elements come from", () => {
    setup([]);
    expect(screen.getByText(/Add an element from the left panel/)).toBeInTheDocument();
  });
});
