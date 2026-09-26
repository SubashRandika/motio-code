"use client";

import { Layers, Wand2 } from "lucide-react";

import { presetsFor } from "@/core/presets";
import type { SceneElement } from "@/core/model";

import { useEditorStore } from "../store-provider";
import { Section } from "./controls";

/**
 * The named presets for the selected element.
 *
 * A preset replaces the element's animations, so the button says what it will
 * do before it does it. The two scene-scoped presets are marked, because they
 * split the panel into more than one element rather than animating this one.
 */
export function PresetPicker({ element }: { element: SceneElement }) {
  const applyPreset = useEditorStore((state) => state.applyPreset);
  const presets = presetsFor(element.type);

  if (presets.length === 0) return null;

  return (
    <Section title="Presets">
      <ul className="flex flex-col gap-1.5">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              onClick={() => applyPreset(element.id, preset.id)}
              className="group flex w-full flex-col gap-0.5 rounded-md border border-line bg-raised px-2.5 py-2 text-left transition-colors hover:border-amber/60 hover:bg-amber-wash"
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-paper">
                {preset.scope === "scene" ? (
                  <Layers className="size-3 text-mist-dim" aria-hidden="true" />
                ) : (
                  <Wand2 className="size-3 text-mist-dim" aria-hidden="true" />
                )}
                {preset.label}
              </span>
              <span className="text-[11.5px] leading-relaxed text-mist-dim">
                {preset.description}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-mist-dim">
        Applying a preset replaces this element&apos;s animations. Undo puts them back.
      </p>
    </Section>
  );
}
