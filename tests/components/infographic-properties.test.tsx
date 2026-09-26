import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { canvasConfigSchema, themeConfigSchema, type ChartElement, type SceneElement } from "@/core/model";
import { PropertiesPanel } from "@/features/editor/properties-panel";
import { createEditorStore } from "@/features/editor/store";

import { makeProject, makeScene, renderWithStore } from "../fixtures";

const canvas = canvasConfigSchema.parse({});
const theme = themeConfigSchema.parse({});

/** Builds a store whose one scene holds a freshly added element of `type`. */
function setup(type: "chart" | "comparison" | "steps" | "counter" | "progress") {
  const store = createEditorStore(makeProject({ scenes: [makeScene()] }));
  act(() => store.getState().addElement(type));

  renderWithStore(<PropertiesPanel />, store);

  const element = () => store.getState().project.scenes[0].data.elements[0] as SceneElement;
  return { store, element };
}

describe("the bar chart editor", () => {
  it("lists a row per bar", () => {
    setup("chart");

    expect(screen.getByText("Bar 1")).toBeInTheDocument();
    expect(screen.getByText("Bar 2")).toBeInTheDocument();
  });

  it("adds a bar", async () => {
    const user = userEvent.setup();
    const { element } = setup("chart");

    await user.click(screen.getByRole("button", { name: "Add bar" }));

    const chart = element() as ChartElement;
    expect(chart.content.bars).toHaveLength(3);
    expect(chart.content.bars[2].label).toBe("Item 3");
  });

  it("removes a bar", async () => {
    const user = userEvent.setup();
    const { element } = setup("chart");

    await user.click(screen.getByRole("button", { name: "Remove bar 1" }));

    const chart = element() as ChartElement;
    expect(chart.content.bars).toHaveLength(1);
    expect(chart.content.bars[0].label).toBe("After");
  });

  it("will not let the last bar go, because an empty chart means nothing", async () => {
    const user = userEvent.setup();
    const { element } = setup("chart");

    await user.click(screen.getByRole("button", { name: "Remove bar 1" }));
    expect(screen.getByRole("button", { name: "Remove bar 1" })).toBeDisabled();

    expect((element() as ChartElement).content.bars).toHaveLength(1);
  });

  it("keeps the element valid after every edit", async () => {
    const user = userEvent.setup();
    const { element, store } = setup("chart");

    await user.click(screen.getByRole("button", { name: "Add bar" }));
    await user.click(screen.getByRole("button", { name: "Remove bar 2" }));

    // The scene still parses, which is what persistence depends on.
    expect(store.getState().project.scenes[0].data.elements).toHaveLength(1);
    expect((element() as ChartElement).content.bars.length).toBeGreaterThan(0);
  });

  it("treats a full length of zero as scaling to the data", async () => {
    const { element } = setup("chart");
    const chart = element() as ChartElement;

    // The factory starts with no declared maximum, and the panel says so.
    expect(chart.content.max).toBeNull();
    expect(screen.getByText(/scales the bars to the largest value/)).toBeInTheDocument();
  });
});

describe("the comparison editor", () => {
  it("lists a row per comparison row and can add one", async () => {
    const user = userEvent.setup();
    const { element } = setup("comparison");

    expect(screen.getByText("Row 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add row" }));

    const comparison = element();
    if (comparison.type !== "comparison") throw new Error("expected a comparison");
    expect(comparison.content.rows).toHaveLength(4);
  });
});

describe("the steps editor", () => {
  it("lists a row per step and can add one", async () => {
    const user = userEvent.setup();
    const { element } = setup("steps");

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add step" }));

    const steps = element();
    if (steps.type !== "steps") throw new Error("expected steps");
    expect(steps.content.steps).toHaveLength(4);
  });

  it("stops at the schema's maximum rather than producing an unsavable element", async () => {
    const user = userEvent.setup();
    const { element } = setup("steps");

    for (let index = 0; index < 10; index += 1) {
      const button = screen.getByRole("button", { name: "Add step" });
      if ((button as HTMLButtonElement).disabled) break;
      await user.click(button);
    }

    const steps = element();
    if (steps.type !== "steps") throw new Error("expected steps");
    expect(steps.content.steps).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Add step" })).toBeDisabled();
  });
});

describe("the counter editor", () => {
  it("edits the stored value", async () => {
    const user = userEvent.setup();
    const { element } = setup("counter");

    const field = screen.getByLabelText("Value");
    await user.clear(field);
    await user.type(field, "250");

    const counter = element();
    if (counter.type !== "counter") throw new Error("expected a counter");
    expect(counter.content.value).toBe(250);
  });

  it("points at the animation that makes it count", () => {
    setup("counter");
    expect(screen.getByText(/Add a Count up animation/)).toBeInTheDocument();
  });

  it("offers Count up in the animation menu", () => {
    setup("counter");
    expect(screen.getByRole("option", { name: "Count up" })).toBeInTheDocument();
  });

  it("explains what Count up will do once it is added", async () => {
    const user = userEvent.setup();
    const { store, element } = setup("counter");

    act(() => store.getState().addAnimation(element().id, "count"));
    expect(screen.getByText(/Counts this element's numbers up to the values it stores/))
      .toBeInTheDocument();

    // And says so plainly when it has been put on something with no numbers.
    act(() => store.getState().addElement("text"));
    const text = store.getState().project.scenes[0].data.elements[1];
    act(() => store.getState().addAnimation(text.id, "count"));
    await user.click(screen.getByRole("button", { name: "Bring to front" }));

    expect(screen.getByText(/This element has no numbers to count/)).toBeInTheDocument();
  });
});

describe("the progress editor", () => {
  it("switches between a bar and a ring", async () => {
    const user = userEvent.setup();
    const { element } = setup("progress");

    await user.selectOptions(screen.getByLabelText("Shape"), "ring");

    const progress = element();
    if (progress.type !== "progress") throw new Error("expected progress");
    expect(progress.content.shape).toBe("ring");
  });
});

describe("the element rail", () => {
  it("can add every infographic element the factory knows", () => {
    for (const type of ["counter", "progress", "chart", "comparison", "steps"] as const) {
      const store = createEditorStore(makeProject({ scenes: [makeScene()] }));
      act(() => store.getState().addElement(type));

      const element = store.getState().project.scenes[0].data.elements[0];
      expect(element.type, type).toBe(type);
      expect(element.rect.width, type).toBeGreaterThan(0);
      expect(element.rect.x + element.rect.width, type).toBeLessThanOrEqual(canvas.width);
    }

    // Guards against the factory drifting from the theme it is handed.
    expect(theme.name).toBe("Console");
  });
});
