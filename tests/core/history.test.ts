import { describe, expect, it } from "vitest";

import {
  COALESCE_WINDOW_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  emptyHistory,
  record,
  redo,
  redoLabel,
  undo,
  undoLabel,
} from "@/core/editing";

describe("history", () => {
  it("starts empty", () => {
    const history = emptyHistory<string>();
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(undo(history, "a")).toBeNull();
    expect(redo(history, "a")).toBeNull();
  });

  it("steps back through recorded states", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "to b" });
    history = record(history, "b", { label: "to c" });

    const first = undo(history, "c");
    expect(first?.present).toBe("b");

    const second = undo(first!.history, first!.present);
    expect(second?.present).toBe("a");
    expect(canUndo(second!.history)).toBe(false);
  });

  it("steps forward again after an undo", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "to b" });

    const back = undo(history, "b")!;
    expect(back.present).toBe("a");

    const forward = redo(back.history, back.present)!;
    expect(forward.present).toBe("b");
  });

  it("drops the redo branch once a new edit lands", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "to b" });

    const back = undo(history, "b")!;
    expect(canRedo(back.history)).toBe(true);

    const afterNewEdit = record(back.history, "a", { label: "to c" });
    expect(canRedo(afterNewEdit)).toBe(false);
  });

  it("collapses a burst of edits on the same target into one step", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "type", coalesceKey: "name", now: 1000 });
    history = record(history, "ab", { label: "type", coalesceKey: "name", now: 1100 });
    history = record(history, "abc", { label: "type", coalesceKey: "name", now: 1200 });

    expect(history.past).toHaveLength(1);
    // Undo returns to before the whole burst, not to the middle of it.
    expect(undo(history, "abcd")?.present).toBe("a");
  });

  it("starts a new step after a pause", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "type", coalesceKey: "name", now: 1000 });
    history = record(history, "ab", {
      label: "type",
      coalesceKey: "name",
      now: 1000 + COALESCE_WINDOW_MS + 1,
    });

    expect(history.past).toHaveLength(2);
  });

  it("keeps a long gesture as one step when the window is disabled", () => {
    let history = emptyHistory<string>();
    for (let i = 0; i < 40; i += 1) {
      history = record(history, `frame-${i}`, {
        label: "drag",
        coalesceKey: "drag-1",
        coalesceWindowMs: Infinity,
        now: 1000 + i * 5000,
      });
    }

    expect(history.past).toHaveLength(1);
    expect(undo(history, "final")?.present).toBe("frame-0");
  });

  it("does not collapse edits on different targets", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "type", coalesceKey: "name:1", now: 1000 });
    history = record(history, "b", { label: "type", coalesceKey: "name:2", now: 1010 });

    expect(history.past).toHaveLength(2);
  });

  it("forgets the oldest step past the limit", () => {
    let history = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      history = record(history, i, { label: `step ${i}` });
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0].snapshot).toBe(10);
  });

  it("names the step each direction would take", () => {
    let history = emptyHistory<string>();
    history = record(history, "a", { label: "Add scene" });

    expect(undoLabel(history)).toBe("Add scene");
    expect(redoLabel(history)).toBeNull();

    const back = undo(history, "b")!;
    expect(redoLabel(back.history)).toBe("Add scene");
  });
});
