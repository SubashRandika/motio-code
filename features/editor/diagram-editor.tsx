"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { parseDiagramSource, type DiagramParseIssue } from "@/core/diagram";
import { cn } from "@/lib/utils/cn";

import { selectActiveScene } from "./store";
import { useEditorStore } from "./store-provider";

const STARTERS: { label: string; source: string }[] = [
  {
    label: "API request",
    source: `flowchart LR
  Client[Client] --> Gateway[API Gateway]
  Gateway --> Auth{Authorized?}
  Auth -->|yes| Service[Orders Service]
  Auth -->|no| Reject[401 Unauthorized]
  Service --> Db[(Orders DB)]`,
  },
  {
    label: "Microservices",
    source: `flowchart TB
  Web[Web App] --> Gateway[API Gateway]
  Gateway --> Orders[Orders]
  Gateway --> Billing[Billing]
  Orders --> Bus{{Event Bus}}
  Billing --> Bus
  Bus --> Email[Email Worker]`,
  },
  {
    label: "Data pipeline",
    source: `flowchart LR
  Source[(Source DB)] --> Extract[Extract]
  Extract --> Transform[Transform]
  Transform --> Warehouse[(Warehouse)]
  Warehouse --> Dash[Dashboard]`,
  },
];

/**
 * The text mode for a diagram.
 *
 * The rule, stated plainly in the panel itself: **text owns the structure,
 * the canvas owns the positions.** Applying the text adds, removes and relabels
 * nodes and routes; it places a node only the first time that node appears, so
 * a layout arranged by hand survives a later edit. Positions are never written
 * back into the text, which is why applying is an explicit action rather than
 * something that happens as you type.
 */
export function DiagramEditor() {
  const scene = useEditorStore(selectActiveScene);
  const setDiagramSource = useEditorStore((state) => state.setDiagramSource);
  const applyDiagramSource = useEditorStore((state) => state.applyDiagramSource);

  const stored = scene?.data.diagram?.source ?? "";
  const [draft, setDraft] = useState(stored);
  const [lastStored, setLastStored] = useState(stored);
  const [dirty, setDirty] = useState(false);
  const [applied, setApplied] = useState<DiagramParseIssue[] | null>(null);

  // Pick up a scene change, or text applied elsewhere, unless the user has
  // unapplied edits in front of them.
  if (stored !== lastStored) {
    setLastStored(stored);
    if (!dirty) setDraft(stored);
  }

  const result = useMemo(() => parseDiagramSource(draft), [draft]);
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const warnings = result.issues.filter((issue) => issue.severity === "warning");
  const issues = applied ?? [...errors, ...warnings];

  if (!scene) return null;

  const update = (next: string) => {
    setDraft(next);
    setDirty(true);
    setApplied(null);
  };

  const apply = () => {
    setDiagramSource(scene.id, draft);
    setApplied(applyDiagramSource(scene.id, draft));
    setDirty(false);
  };

  return (
    <section
      aria-label="Diagram text"
      className="flex h-72 shrink-0 flex-col border-t border-line bg-panel"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
          Diagram text
        </h2>

        <span
          className={cn(
            "tabular text-[11px]",
            draft.trim() === ""
              ? "text-mist-dim"
              : errors.length > 0
                ? "text-danger"
                : "text-ok",
          )}
        >
          {draft.trim() === ""
            ? "empty"
            : errors.length > 0
              ? `${errors.length} error${errors.length === 1 ? "" : "s"}`
              : `${result.diagram.nodes.length} nodes, ${result.diagram.edges.length} routes`}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.label}
              type="button"
              onClick={() => update(starter.source)}
              className="rounded border border-line bg-raised px-2 py-1 text-[11px] text-mist transition-colors hover:border-line-strong hover:text-paper"
            >
              {starter.label}
            </button>
          ))}

          <Button size="sm" onClick={apply} disabled={!result.ok}>
            Apply to canvas
          </Button>
        </div>
      </div>

      <p className="border-b border-line px-3 py-1.5 text-[11.5px] text-mist-dim">
        Text owns the structure; the canvas owns the positions. Applying keeps every node you have
        already moved where you put it.
      </p>

      <div className="flex min-h-0 flex-1">
        <label className="sr-only" htmlFor="diagram-source">
          Diagram definition
        </label>
        <textarea
          id="diagram-source"
          value={draft}
          spellCheck={false}
          aria-invalid={errors.length > 0}
          placeholder={"flowchart LR\n  A[Client] --> B[API]\n  B --> C[(Database)]"}
          onChange={(event) => update(event.target.value)}
          className="tabular min-h-0 flex-1 resize-none bg-ink-sunk p-3 text-[12px] leading-relaxed text-paper placeholder:text-mist-dim"
        />

        {issues.length > 0 ? (
          <ul
            role={errors.length > 0 ? "alert" : undefined}
            className="w-72 shrink-0 space-y-1.5 overflow-y-auto border-l border-line p-3"
          >
            {issues.map((issue, index) => (
              <li
                key={index}
                className={cn(
                  "text-[11.5px] leading-relaxed",
                  issue.severity === "error" ? "text-danger" : "text-mist",
                )}
              >
                <span className="tabular text-mist-dim">line {issue.line}</span> {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
