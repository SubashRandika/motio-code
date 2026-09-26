import { act, fireEvent } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTimeline } from "@/core/animation";
import { isConnector, isNode, type SceneElement } from "@/core/model";
import { CanvasStage, paintOrder } from "@/features/editor/canvas-stage";
import { createEditorStore } from "@/features/editor/store";

import { makeConnectorElement, makeNodeElement, makeProject, makeTextElement, renderWithStore } from "../fixtures";

/** Bounds chosen so the stage's fit-to-container maths lands on exactly 0.5. */
const STUB_BOX = { left: 0, top: 0, width: 1016, height: 596, right: 1016, bottom: 596, x: 0, y: 0 };

const original = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () => STUB_BOX as DOMRect;
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = original;
});

const NODE_A = makeNodeElement({
  id: "nd_1",
  name: "Gateway",
  layer: 0,
  rect: { x: 100, y: 100, width: 200, height: 100 },
});
const NODE_B = makeNodeElement({
  id: "nd_2",
  name: "Service",
  layer: 1,
  rect: { x: 800, y: 100, width: 200, height: 100 },
  content: { ...makeNodeElement().content, label: "Service" },
});

function setup(elements: SceneElement[]) {
  const project = makeProject();
  project.scenes[0].data.elements = elements;
  const store = createEditorStore(project);
  const timeline = buildTimeline(project.scenes);

  renderWithStore(<CanvasStage timeline={timeline} frame={0} />, store);

  const stage = document.querySelector<HTMLElement>("[data-canvas-stage]")!;
  const elementsOf = () => store.getState().project.scenes[0].data.elements;

  return { store, stage, elementsOf };
}

describe("paintOrder", () => {
  it("keeps everything together when there are no connectors", () => {
    const order = paintOrder([NODE_A, NODE_B]);
    expect(order.connectors).toHaveLength(0);
    expect(order.behind).toHaveLength(2);
  });

  it("puts the connector layer below the nodes it joins", () => {
    const connector = makeConnectorElement({ layer: 0 });
    const nodes = [
      { ...NODE_A, layer: 1 },
      { ...NODE_B, layer: 2 },
    ];
    const background = makeTextElement({ id: "el_bg", layer: 0 });

    const order = paintOrder([background, connector, ...nodes]);

    expect(order.connectors.map((item) => item.id)).toEqual(["cn_1"]);
    expect(order.behind.map((item) => item.id)).toEqual([]);
    expect(order.inFront.map((item) => item.id)).toEqual(["el_bg", "nd_1", "nd_2"]);
  });

  it("leaves elements below the lowest connector behind the layer", () => {
    const background = makeTextElement({ id: "el_bg", layer: 0 });
    const connector = makeConnectorElement({ layer: 1 });

    const order = paintOrder([background, connector, { ...NODE_A, layer: 2 }]);
    expect(order.behind.map((item) => item.id)).toEqual(["el_bg"]);
    expect(order.inFront.map((item) => item.id)).toEqual(["nd_1"]);
  });
});

describe("node rendering", () => {
  it("draws a node with its label", () => {
    setup([NODE_A]);
    const node = document.querySelector('[data-element-id="nd_1"]');
    expect(node).not.toBeNull();
    expect(node!.textContent).toContain("Gateway");
  });

  it("draws every shape as SVG rather than a CSS box", () => {
    for (const shape of ["rectangle", "diamond", "hexagon", "circle", "cylinder", "pill"] as const) {
      const { unmount } = renderWithStore(<div />, createEditorStore(makeProject()));
      unmount();

      document.body.innerHTML = "";
      setup([{ ...NODE_A, content: { ...NODE_A.content, shape } }]);

      const node = document.querySelector('[data-element-id="nd_1"]')!;
      expect(node.querySelector("svg")).not.toBeNull();
      // The wrapper must not paint its own box behind a non-rectangular shape.
      expect((node as HTMLElement).style.backgroundColor).toBe("");
      document.body.innerHTML = "";
    }
  });
});

describe("connector rendering", () => {
  it("draws one route per connector, derived from the node boxes", () => {
    setup([NODE_A, NODE_B, makeConnectorElement()]);

    const route = document.querySelector('[data-element-id="cn_1"]');
    expect(route).not.toBeNull();
    // Route geometry comes from the nodes, so it starts on A's right edge.
    expect(route!.getAttribute("d")).toContain("M 300 150");
  });

  it("follows a node that moves, with no stored geometry to go stale", () => {
    const { store } = setup([NODE_A, NODE_B, makeConnectorElement()]);

    const before = document.querySelector('[data-element-id="cn_1"]')!.getAttribute("d");

    act(() =>
      store.getState().setElementRects([{ id: "nd_1", rect: { x: 100, y: 600, width: 200, height: 100 } }]),
    );

    const after = document.querySelector('[data-element-id="cn_1"]')!.getAttribute("d");
    expect(after).not.toBe(before);
    expect(after).toContain("650");
  });

  it("skips a connector whose endpoint is missing instead of crashing", () => {
    setup([NODE_A, makeConnectorElement()]);
    expect(document.querySelector('[data-element-id="cn_1"]')).toBeNull();
  });

  it("shows a label on the route", () => {
    setup([NODE_A, NODE_B, makeConnectorElement({ content: { label: "200 OK" } })]);
    expect(document.querySelector("svg text")?.textContent).toBe("200 OK");
  });
});

describe("connecting nodes", () => {
  it("shows four connect nubs for a selected node, outside its resize handles", () => {
    const { store } = setup([NODE_A, NODE_B]);
    act(() => store.getState().selectElement("nd_1"));

    expect(document.querySelectorAll("[data-connect-nub]")).toHaveLength(4);
    expect(document.querySelectorAll("[data-resize-handle]")).toHaveLength(8);
  });

  it("shows no nubs for a selected connector", () => {
    const { store } = setup([NODE_A, NODE_B, makeConnectorElement()]);
    act(() => store.getState().selectElement("cn_1"));

    expect(document.querySelectorAll("[data-connect-nub]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-resize-handle]")).toHaveLength(0);
  });

  it("draws a connector when a nub is dropped on another node", () => {
    const { store, stage, elementsOf } = setup([NODE_A, NODE_B]);
    act(() => store.getState().selectElement("nd_1"));

    const nub = document.querySelector('[data-connect-nub="right"]')!;
    // 450,75 in screen pixels is 900,150 in canvas units: inside node B.
    fireEvent.pointerDown(nub, { clientX: 150, clientY: 75, pointerId: 1, button: 0 });
    fireEvent.pointerMove(stage, { clientX: 450, clientY: 75, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 450, clientY: 75, pointerId: 1 });

    const connectors = elementsOf().filter(isConnector);
    expect(connectors).toHaveLength(1);
    expect(connectors[0].content.sourceId).toBe("nd_1");
    expect(connectors[0].content.targetId).toBe("nd_2");
    expect(connectors[0].content.sourceAnchor).toBe("right");
  });

  it("draws nothing when the drag ends on empty canvas", () => {
    const { store, stage, elementsOf } = setup([NODE_A, NODE_B]);
    act(() => store.getState().selectElement("nd_1"));

    const nub = document.querySelector('[data-connect-nub="right"]')!;
    fireEvent.pointerDown(nub, { clientX: 150, clientY: 75, pointerId: 1, button: 0 });
    fireEvent.pointerMove(stage, { clientX: 200, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 200, clientY: 500, pointerId: 1 });

    expect(elementsOf().filter(isConnector)).toHaveLength(0);
  });

  it("refuses to join a node to itself", () => {
    const { store, stage, elementsOf } = setup([NODE_A]);
    act(() => store.getState().selectElement("nd_1"));

    const nub = document.querySelector('[data-connect-nub="right"]')!;
    fireEvent.pointerDown(nub, { clientX: 150, clientY: 75, pointerId: 1, button: 0 });
    fireEvent.pointerMove(stage, { clientX: 100, clientY: 75, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 100, clientY: 75, pointerId: 1 });

    expect(elementsOf().filter(isConnector)).toHaveLength(0);
  });

  it("does not draw the same route twice", () => {
    const store = createEditorStore(
      makeProject({
        scenes: [
          { ...makeProject().scenes[0], data: { ...makeProject().scenes[0].data, elements: [NODE_A, NODE_B] } },
          makeProject().scenes[1],
        ],
      }),
    );

    act(() => store.getState().connectNodes("nd_1", "nd_2"));
    act(() => store.getState().connectNodes("nd_1", "nd_2"));

    expect(store.getState().project.scenes[0].data.elements.filter(isConnector)).toHaveLength(1);
  });

  it("selects a connector when its route is clicked", () => {
    const { store } = setup([NODE_A, NODE_B, makeConnectorElement()]);

    const hit = document.querySelector('[data-element-id="cn_1"]')!;
    fireEvent.pointerDown(hit, { clientX: 250, clientY: 75, pointerId: 1, button: 0 });
    fireEvent.pointerUp(hit, { clientX: 250, clientY: 75, pointerId: 1 });

    expect(store.getState().selectedElementIds).toEqual(["cn_1"]);
  });

  it("never drags a connector, because its box is derived", () => {
    const { store, elementsOf } = setup([NODE_A, NODE_B, makeConnectorElement()]);

    const hit = document.querySelector('[data-element-id="cn_1"]')!;
    fireEvent.pointerDown(hit, { clientX: 250, clientY: 75, pointerId: 1, button: 0 });
    fireEvent.pointerMove(hit, { clientX: 400, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(hit, { clientX: 400, clientY: 300, pointerId: 1 });

    expect(store.getState().history.past).toHaveLength(0);
    expect(elementsOf().filter(isNode).map((node) => node.rect.x)).toEqual([100, 800]);
  });
});

describe("deleting and duplicating a diagram", () => {
  it("takes a node's connectors with it", () => {
    const { store, elementsOf } = setup([NODE_A, NODE_B, makeConnectorElement()]);

    act(() => {
      store.getState().selectElement("nd_1");
      store.getState().deleteSelection();
    });

    expect(elementsOf().filter(isConnector)).toHaveLength(0);
    expect(elementsOf().filter(isNode)).toHaveLength(1);
  });

  it("repoints duplicated connectors at the duplicated nodes", () => {
    const { store, elementsOf } = setup([NODE_A, NODE_B, makeConnectorElement()]);

    act(() => {
      store.getState().selectElements(["nd_1", "nd_2", "cn_1"]);
      store.getState().duplicateSelection();
    });

    const nodes = elementsOf().filter(isNode);
    const connectors = elementsOf().filter(isConnector);
    expect(nodes).toHaveLength(4);
    expect(connectors).toHaveLength(2);

    const copy = connectors.find((item) => item.id !== "cn_1")!;
    const copiedIds = new Set(nodes.filter((node) => node.id !== "nd_1" && node.id !== "nd_2").map((n) => n.id));
    expect(copiedIds.has(copy.content.sourceId)).toBe(true);
    expect(copiedIds.has(copy.content.targetId)).toBe(true);
  });

  it("drops a copied connector when only one of its nodes came along", () => {
    const { store, elementsOf } = setup([NODE_A, NODE_B, makeConnectorElement()]);

    act(() => {
      store.getState().selectElements(["nd_1", "cn_1"]);
      store.getState().duplicateSelection();
    });

    // The original route survives; no copy re-attaches to the original target.
    expect(elementsOf().filter(isConnector)).toHaveLength(1);
  });

  it("clears a duplicated node's link to the diagram text", () => {
    const fromText = { ...NODE_A, content: { ...NODE_A.content, sourceKey: "A" } };
    const { store, elementsOf } = setup([fromText]);

    act(() => {
      store.getState().selectElement("nd_1");
      store.getState().duplicateSelection();
    });

    const copy = elementsOf().filter(isNode).find((node) => node.id !== "nd_1")!;
    expect(copy.content.sourceKey).toBeNull();
  });
});
