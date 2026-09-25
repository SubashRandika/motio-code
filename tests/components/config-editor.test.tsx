import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ConfigEditor } from "@/features/editor/config-editor";
import { createEditorStore } from "@/features/editor/store";

import { makeProject, makeTextElement, renderWithStore } from "../fixtures";

function setup(elements = [makeTextElement()]) {
  const project = makeProject();
  project.scenes[0].data.elements = elements;
  const store = createEditorStore(project);

  renderWithStore(<ConfigEditor />, store);

  const textarea = screen.getByLabelText("Scene configuration as JSON") as HTMLTextAreaElement;
  const sceneData = () => store.getState().project.scenes[0].data;

  return { store, textarea, sceneData };
}

/** Replaces the whole document without typing it character by character. */
async function replaceWith(textarea: HTMLTextAreaElement, value: string) {
  const user = userEvent.setup();
  await user.clear(textarea);
  await user.paste(value);
}

describe("ConfigEditor", () => {
  it("shows the active scene's data as formatted JSON", () => {
    const { textarea } = setup();
    expect(JSON.parse(textarea.value).elements).toHaveLength(1);
    expect(screen.getByText("valid")).toBeInTheDocument();
  });

  it("does nothing until the edit is applied", async () => {
    const { textarea, sceneData } = setup();

    await replaceWith(textarea, JSON.stringify({ elements: [], notes: "hello" }));

    expect(sceneData().elements).toHaveLength(1);
    expect(sceneData().notes).toBe("");
  });

  it("applies a valid edit", async () => {
    const user = userEvent.setup();
    const { textarea, sceneData } = setup();

    await replaceWith(textarea, JSON.stringify({ elements: [], notes: "Explain the retry path" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(sceneData().notes).toBe("Explain the retry path");
    expect(sceneData().elements).toHaveLength(0);
  });

  it("reports malformed JSON and keeps what was typed", async () => {
    const { textarea } = setup();

    await replaceWith(textarea, "{ not json");

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    // The draft survives the error rather than snapping back.
    expect(textarea.value).toBe("{ not json");
  });

  it("reports schema problems with the path that failed", async () => {
    const { textarea } = setup();

    await replaceWith(textarea, JSON.stringify({ elements: [{ type: "hologram" }] }));

    expect(screen.getByRole("alert")).toHaveTextContent("elements.0");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("marks the draft valid again once the problem is fixed", async () => {
    const { textarea } = setup();

    await replaceWith(textarea, "{ not json");
    expect(screen.getByText(/1 problem/)).toBeInTheDocument();

    await replaceWith(textarea, JSON.stringify({ elements: [] }));
    expect(screen.getByText("valid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  it("reverts back to the saved scene", async () => {
    const user = userEvent.setup();
    const { textarea } = setup();
    const original = textarea.value;

    await replaceWith(textarea, JSON.stringify({ elements: [] }));
    expect(textarea.value).not.toBe(original);

    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(textarea.value).toBe(original);
  });

  it("picks up changes made on the canvas while the draft is clean", async () => {
    const { store, textarea } = setup();

    act(() => store.getState().addElement("shape"));

    expect(JSON.parse(textarea.value).elements).toHaveLength(2);
  });

  it("does not overwrite an unapplied draft", async () => {
    const { store, textarea } = setup();

    await replaceWith(textarea, JSON.stringify({ elements: [], notes: "mine" }));
    act(() => store.getState().addElement("shape"));

    expect(JSON.parse(textarea.value).notes).toBe("mine");
  });

  it("is one undo step", async () => {
    const user = userEvent.setup();
    const { store, textarea, sceneData } = setup();

    await replaceWith(textarea, JSON.stringify({ elements: [], notes: "applied" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(store.getState().history.past).toHaveLength(1);

    act(() => store.getState().undo());
    expect(sceneData().elements).toHaveLength(1);
  });
});
