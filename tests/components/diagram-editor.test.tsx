import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { isConnector, isNode } from "@/core/model";
import { DiagramEditor } from "@/features/editor/diagram-editor";
import { createEditorStore } from "@/features/editor/store";

import { makeProject, renderWithStore } from "../fixtures";

const SOURCE = `flowchart LR
  A[Client] --> B[API]
  B --> C[(Database)]`;

function setup() {
  const store = createEditorStore(makeProject());
  renderWithStore(<DiagramEditor />, store);

  const textarea = screen.getByLabelText("Diagram definition") as HTMLTextAreaElement;
  const sceneData = () => store.getState().project.scenes[0].data;

  return { store, textarea, sceneData };
}

async function write(textarea: HTMLTextAreaElement, value: string) {
  const user = userEvent.setup();
  await user.clear(textarea);
  await user.paste(value);
}

describe("DiagramEditor", () => {
  it("states which mode owns what", () => {
    setup();
    expect(
      screen.getByText(/Text owns the structure; the canvas owns the positions/),
    ).toBeInTheDocument();
  });

  it("counts what a valid definition will produce", async () => {
    const { textarea } = setup();
    await write(textarea, SOURCE);
    expect(screen.getByText("3 nodes, 2 routes")).toBeInTheDocument();
  });

  it("does not touch the canvas until the text is applied", async () => {
    const { textarea, sceneData } = setup();
    await write(textarea, SOURCE);

    expect(sceneData().elements).toHaveLength(0);
    expect(sceneData().diagram).toBeNull();
  });

  it("compiles nodes and routes onto the canvas when applied", async () => {
    const user = userEvent.setup();
    const { textarea, sceneData } = setup();

    await write(textarea, SOURCE);
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    expect(sceneData().elements.filter(isNode)).toHaveLength(3);
    expect(sceneData().elements.filter(isConnector)).toHaveLength(2);
    expect(sceneData().diagram?.source).toBe(SOURCE);
    expect(sceneData().diagram?.appliedAt).not.toBeNull();
  });

  it("paints routes beneath the nodes they join", async () => {
    const user = userEvent.setup();
    const { textarea, sceneData } = setup();

    await write(textarea, SOURCE);
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    const highestConnector = Math.max(
      ...sceneData().elements.filter(isConnector).map((item) => item.layer),
    );
    const lowestNode = Math.min(...sceneData().elements.filter(isNode).map((item) => item.layer));

    expect(highestConnector).toBeLessThan(lowestNode);
  });

  it("reports an error with its line and refuses to apply", async () => {
    const { textarea } = setup();
    // No closing bracket anywhere on the line, so the shape never terminates.
    // `A[Client --> B[API]` would *not* be an error: the first `]` closes it.
    await write(textarea, "flowchart LR\n  A[Client --> B");

    expect(screen.getByRole("alert")).toHaveTextContent("line 2");
    expect(screen.getByRole("button", { name: "Apply to canvas" })).toBeDisabled();
  });

  it("keeps the text exactly as typed when it does not parse", async () => {
    const broken = "flowchart LR\n  A[Client --> B";
    const { textarea } = setup();

    await write(textarea, broken);
    expect(textarea.value).toBe(broken);
  });

  it("warns without blocking on syntax it does not model", async () => {
    const { textarea } = setup();
    await write(textarea, "flowchart LR\n  subgraph edge\n  A[a] --> B[b]\n  end");

    expect(screen.getByRole("button", { name: "Apply to canvas" })).toBeEnabled();
    // "subgraph" and "end" are each reported; neither blocks applying.
    expect(screen.getAllByText(/not supported yet/)).toHaveLength(2);
    expect(screen.getByText(/"subgraph" is not supported yet/)).toBeInTheDocument();
  });

  it("keeps a node where the user moved it when the text is re-applied", async () => {
    const user = userEvent.setup();
    const { store, textarea, sceneData } = setup();

    await write(textarea, SOURCE);
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    const client = sceneData().elements.filter(isNode)[0];
    act(() =>
      store
        .getState()
        .setElementRects([{ id: client.id, rect: { ...client.rect, x: 40, y: 80 } }]),
    );

    await write(textarea, SOURCE.replace("--> C[(Database)]", "--> C[(Warehouse)]"));
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    const afterwards = sceneData().elements.filter(isNode)[0];
    expect(afterwards.id).toBe(client.id);
    expect(afterwards.rect.x).toBe(40);
    expect(afterwards.rect.y).toBe(80);
  });

  it("removes a node the text no longer mentions, and its route", async () => {
    const user = userEvent.setup();
    const { textarea, sceneData } = setup();

    await write(textarea, SOURCE);
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    await write(textarea, "flowchart LR\n  A[Client] --> B[API]");
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    expect(sceneData().elements.filter(isNode)).toHaveLength(2);
    expect(sceneData().elements.filter(isConnector)).toHaveLength(1);
  });

  it("leaves elements that are not part of the diagram alone", async () => {
    const user = userEvent.setup();
    const { store, textarea, sceneData } = setup();

    act(() => store.getState().addElement("text"));
    await write(textarea, SOURCE);
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    expect(sceneData().elements.filter((element) => element.type === "text")).toHaveLength(1);
    expect(sceneData().elements.filter(isNode)).toHaveLength(3);
  });

  it("applies as a single undo step", async () => {
    const user = userEvent.setup();
    const { store, textarea, sceneData } = setup();

    await write(textarea, SOURCE);
    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));

    // Storing the text and compiling it are two edits the user made as one, so
    // undo twice returns to an empty scene.
    act(() => store.getState().undo());
    act(() => store.getState().undo());

    expect(sceneData().elements).toHaveLength(0);
  });

  it("offers starter definitions that parse", async () => {
    const user = userEvent.setup();
    const { textarea, sceneData } = setup();

    for (const starter of ["API request", "Microservices", "Data pipeline"]) {
      await user.click(screen.getByRole("button", { name: starter }));
      expect(screen.getByRole("button", { name: "Apply to canvas" })).toBeEnabled();
    }

    await user.click(screen.getByRole("button", { name: "Apply to canvas" }));
    expect(sceneData().elements.filter(isNode).length).toBeGreaterThan(0);
    expect(textarea.value).toContain("flowchart");
  });
});
