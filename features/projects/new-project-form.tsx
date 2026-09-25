"use client";

import { Boxes, Code2, GitBranch, Layers } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ASPECT_RATIOS, CANVAS_PRESETS, FPS_OPTIONS } from "@/core/model/canvas";
import type { ContentType } from "@/core/model/project";
import { cn } from "@/lib/utils/cn";

import { createProjectAction, type ActionState } from "./actions";

const EMPTY: ActionState = {};

const CONTENT_CHOICES: {
  value: ContentType;
  label: string;
  hint: string;
  icon: typeof Code2;
}[] = [
  { value: "code", label: "Code", hint: "Snippets, walkthroughs, comparisons", icon: Code2 },
  { value: "diagram", label: "Diagram", hint: "Architecture, flows, infrastructure", icon: GitBranch },
  { value: "infographic", label: "Infographic", hint: "Counters, charts, step sequences", icon: Boxes },
  { value: "mixed", label: "Mixed", hint: "A bit of everything", icon: Layers },
];

export function NewProjectForm() {
  const [state, formAction] = useActionState(createProjectAction, EMPTY);
  const [contentType, setContentType] = useState<ContentType>("code");
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>("16:9");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormError>{state.error}</FormError>

      <Panel className="p-5">
        <Field label="Project name" error={state.fieldErrors?.name}>
          {(props) => (
            <Input
              {...props}
              name="name"
              maxLength={120}
              required
              autoFocus
              placeholder="How our auth flow works"
            />
          )}
        </Field>
      </Panel>

      <fieldset>
        <legend className="text-[13px] font-medium text-mist">What are you explaining?</legend>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONTENT_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer flex-col gap-2 rounded-panel border bg-panel p-4 transition-colors duration-150",
                contentType === choice.value
                  ? "border-amber bg-amber-wash"
                  : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="contentType"
                value={choice.value}
                checked={contentType === choice.value}
                onChange={() => setContentType(choice.value)}
                className="sr-only"
              />
              <choice.icon
                className={cn("size-4", contentType === choice.value ? "text-amber" : "text-mist")}
                aria-hidden="true"
              />
              <span className="text-[14px] font-medium">{choice.label}</span>
              <span className="text-[12px] leading-snug text-mist-dim">{choice.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-medium text-mist">Canvas</legend>
        <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ASPECT_RATIOS.map((ratio) => {
            const preset = CANVAS_PRESETS[ratio];
            const selected = aspectRatio === ratio;
            return (
              <label
                key={ratio}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-3 rounded-panel border bg-panel p-4 transition-colors duration-150",
                  selected ? "border-amber bg-amber-wash" : "border-line hover:border-line-strong",
                )}
              >
                <input
                  type="radio"
                  name="aspectRatio"
                  value={ratio}
                  checked={selected}
                  onChange={() => setAspectRatio(ratio)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-full max-w-[84px] rounded-sm border",
                    selected ? "border-amber/60 bg-amber/10" : "border-line-strong bg-ink-sunk",
                  )}
                  style={{ aspectRatio: ratio.replace(":", " / ") }}
                />
                <span className="tabular text-[13px]">{ratio}</span>
                <span className="text-[11.5px] leading-snug text-mist-dim">{preset.use}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Panel className="flex flex-wrap items-end justify-between gap-4 p-5">
        <Field label="Frame rate" hint="30 is a good default." error={state.fieldErrors?.fps}>
          {(props) => (
            <Select {...props} name="fps" defaultValue="30" className="w-40">
              {FPS_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </Select>
          )}
        </Field>

        <p className="tabular text-[12px] text-mist-dim">
          {CANVAS_PRESETS[aspectRatio].width} × {CANVAS_PRESETS[aspectRatio].height}
        </p>
      </Panel>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Creating project…" : "Create project and open editor"}
    </Button>
  );
}
