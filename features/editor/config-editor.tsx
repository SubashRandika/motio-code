"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { sceneDataSchema } from "@/core/model";

import { selectActiveScene } from "./store";
import { useEditorStore } from "./store-provider";

interface Validation {
  ok: boolean;
  issues: string[];
}

function validate(text: string): Validation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      issues: [error instanceof Error ? error.message : "That is not valid JSON."],
    };
  }

  const result = sceneDataSchema.safeParse(parsed);
  if (result.success) return { ok: true, issues: [] };

  return {
    ok: false,
    issues: result.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join(".") || "scene"}: ${issue.message}`),
  };
}

/**
 * The optional configuration panel.
 *
 * Edits here are never applied as you type: the draft is validated against the
 * same schema the server uses, and a failed validation leaves the text exactly
 * as written so nothing typed is lost.
 */
export function ConfigEditor() {
  const scene = useEditorStore(selectActiveScene);
  const replaceSceneData = useEditorStore((state) => state.replaceSceneData);

  const serialized = useMemo(
    () => (scene ? JSON.stringify(scene.data, null, 2) : ""),
    [scene],
  );

  const [draft, setDraft] = useState(serialized);
  const [dirty, setDirty] = useState(false);
  const [lastSerialized, setLastSerialized] = useState(serialized);

  // Pull in changes made on the canvas, unless the user has unapplied edits.
  if (serialized !== lastSerialized) {
    setLastSerialized(serialized);
    if (!dirty) setDraft(serialized);
  }

  const validation = useMemo(() => validate(draft), [draft]);

  if (!scene) return null;

  const apply = () => {
    const parsed = sceneDataSchema.safeParse(JSON.parse(draft));
    if (!parsed.success) return;

    replaceSceneData(scene.id, parsed.data);
    setDirty(false);
  };

  const revert = () => {
    setDraft(serialized);
    setDirty(false);
  };

  return (
    <section
      aria-label="Scene configuration"
      className="flex h-64 shrink-0 flex-col border-t border-line bg-panel"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
          Configuration — {scene.name}
        </h2>

        <span
          className={
            validation.ok
              ? "tabular ml-2 text-[11px] text-ok"
              : "tabular ml-2 text-[11px] text-danger"
          }
        >
          {validation.ok ? "valid" : `${validation.issues.length} problem${validation.issues.length === 1 ? "" : "s"}`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={revert} disabled={!dirty}>
            Revert
          </Button>
          <Button size="sm" onClick={apply} disabled={!dirty || !validation.ok}>
            Apply
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <label className="sr-only" htmlFor="scene-config">
          Scene configuration as JSON
        </label>
        <textarea
          id="scene-config"
          value={draft}
          spellCheck={false}
          aria-invalid={!validation.ok}
          onChange={(event) => {
            setDraft(event.target.value);
            setDirty(true);
          }}
          className="tabular min-h-0 flex-1 resize-none bg-ink-sunk p-3 text-[12px] leading-relaxed text-paper outline-none"
        />

        {validation.issues.length > 0 ? (
          <ul
            role="alert"
            className="w-72 shrink-0 space-y-1.5 overflow-y-auto border-l border-line p-3"
          >
            {validation.issues.map((issue, index) => (
              <li key={index} className="tabular text-[11.5px] leading-relaxed text-danger">
                {issue}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
