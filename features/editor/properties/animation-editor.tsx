"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  ANIMATION_TYPES,
  DIRECTIONS,
  EASINGS,
  isNumeric,
  type Animation,
  type AnimationType,
  type SceneElement,
} from "@/core/model";
import { formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

import { useEditorStore } from "../store-provider";
import { NumberField, Row, SelectField, Section } from "./controls";

const TYPE_LABELS: Record<AnimationType, string> = {
  fade: "Fade",
  slide: "Slide",
  scale: "Scale",
  highlight: "Highlight",
  emphasis: "Emphasis",
  reveal: "Reveal",
  flow: "Flow along route",
  focus: "Focus lines",
  count: "Count up",
};

const TRIGGER_OPTIONS = [
  { value: "enter" as const, label: "On enter" },
  { value: "exit" as const, label: "On exit" },
  { value: "at" as const, label: "At an offset" },
];

const EASING_OPTIONS = EASINGS.map((easing) => ({ value: easing, label: easing }));
const DIRECTION_OPTIONS = DIRECTIONS.map((direction) => ({ value: direction, label: direction }));

export function AnimationEditor({ element, fps }: { element: SceneElement; fps: number }) {
  const addAnimation = useEditorStore((state) => state.addAnimation);
  const removeAnimation = useEditorStore((state) => state.removeAnimation);

  return (
    <Section
      title="Animation"
      action={
        <AddAnimationMenu onAdd={(type) => addAnimation(element.id, type)} />
      }
    >
      {element.animations.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-mist-dim">
          No animation yet. The element simply appears for its whole time on the timeline.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {element.animations.map((animation) => (
            <li key={animation.id} className="rounded-md border border-line bg-ink-sunk p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-medium text-paper">
                  {TYPE_LABELS[animation.type]}
                </span>
                <button
                  type="button"
                  onClick={() => removeAnimation(element.id, animation.id)}
                  aria-label={`Remove ${TYPE_LABELS[animation.type]} animation`}
                  className="grid size-6 place-items-center rounded text-mist transition-colors hover:bg-danger-wash hover:text-danger"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <AnimationFields element={element} animation={animation} fps={fps} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AnimationFields({
  element,
  animation,
  fps,
}: {
  element: SceneElement;
  animation: Animation;
  fps: number;
}) {
  const updateAnimation = useEditorStore((state) => state.updateAnimation);

  const patch = (changes: Partial<Animation>, key: string) =>
    updateAnimation(element.id, animation.id, changes, {
      coalesceKey: `animation:${animation.id}:${key}`,
    });

  return (
    <>
      <Row>
        <SelectField
          label="Runs"
          value={animation.trigger}
          options={TRIGGER_OPTIONS}
          onChange={(trigger) => patch({ trigger }, "trigger")}
        />
        <SelectField
          label="Easing"
          value={animation.easing}
          options={EASING_OPTIONS}
          onChange={(easing) => patch({ easing }, "easing")}
        />
      </Row>

      <Row>
        <NumberField
          label="Offset"
          value={animation.offsetInFrames}
          min={0}
          suffix="f"
          disabled={animation.trigger === "exit"}
          onChange={(offsetInFrames) => patch({ offsetInFrames }, "offset")}
        />
        <NumberField
          label="Length"
          value={animation.durationInFrames}
          min={1}
          suffix="f"
          onChange={(durationInFrames) => patch({ durationInFrames }, "duration")}
        />
      </Row>

      <p className="tabular text-[11px] text-mist-dim">
        {formatDuration(animation.durationInFrames, fps)} at {fps}fps
        {animation.trigger === "exit" ? " · ends on the element's last frame" : ""}
      </p>

      {animation.type === "fade" ? (
        <Row>
          <NumberField
            label="From"
            value={animation.from}
            min={0}
            max={1}
            step={0.05}
            onChange={(from) => patch({ from }, "from")}
          />
          <NumberField
            label="To"
            value={animation.to}
            min={0}
            max={1}
            step={0.05}
            onChange={(to) => patch({ to }, "to")}
          />
        </Row>
      ) : null}

      {animation.type === "slide" ? (
        <Row>
          <SelectField
            label="From"
            value={animation.direction}
            options={DIRECTION_OPTIONS}
            onChange={(direction) => patch({ direction }, "direction")}
          />
          <NumberField
            label="Distance"
            value={animation.distance}
            min={0}
            onChange={(distance) => patch({ distance }, "distance")}
          />
        </Row>
      ) : null}

      {animation.type === "scale" ? (
        <Row>
          <NumberField
            label="From"
            value={animation.from}
            min={0}
            max={10}
            step={0.02}
            onChange={(from) => patch({ from }, "from")}
          />
          <NumberField
            label="To"
            value={animation.to}
            min={0}
            max={10}
            step={0.02}
            onChange={(to) => patch({ to }, "to")}
          />
        </Row>
      ) : null}

      {animation.type === "emphasis" ? (
        <NumberField
          label="Peak scale"
          value={animation.peak}
          min={1}
          max={3}
          step={0.02}
          onChange={(peak) => patch({ peak }, "peak")}
        />
      ) : null}

      {animation.type === "highlight" ? (
        <NumberField
          label="Intensity"
          value={animation.intensity}
          min={0}
          max={1}
          step={0.05}
          onChange={(intensity) => patch({ intensity }, "intensity")}
        />
      ) : null}

      {animation.type === "reveal" ? (
        <NumberField
          label="Stagger"
          value={animation.staggerInFrames}
          min={0}
          suffix="f"
          onChange={(staggerInFrames) => patch({ staggerInFrames }, "stagger")}
        />
      ) : null}

      {animation.type === "count" ? (
        <p
          className={cn(
            "text-[11px] leading-relaxed",
            isNumeric(element) ? "text-mist-dim" : "text-amber",
          )}
        >
          {isNumeric(element)
            ? "Counts this element's numbers up to the values it stores."
            : "This element has no numbers to count. Only a counter, a progress indicator or a chart reads this."}
        </p>
      ) : null}

      {animation.type === "focus" ? (
        <>
          <Row>
            <NumberField
              label="From line"
              value={animation.fromPart}
              min={1}
              max={2000}
              onChange={(fromPart) => patch({ fromPart }, "fromPart")}
            />
            <NumberField
              label="To line"
              value={animation.toPart}
              min={1}
              max={2000}
              onChange={(toPart) => patch({ toPart }, "toPart")}
            />
          </Row>
          <NumberField
            label="Dim the rest to"
            value={animation.dim}
            min={0}
            max={1}
            step={0.05}
            onChange={(dim) => patch({ dim }, "dim")}
          />
          <p className="text-[11px] leading-relaxed text-mist-dim">
            Add several to walk down the code: whichever one has most recently started is the one in
            force.
          </p>
        </>
      ) : null}

      {animation.type === "flow" ? (
        <>
          <Row>
            <NumberField
              label="Markers"
              value={animation.markers}
              min={1}
              max={6}
              onChange={(markers) => patch({ markers }, "markers")}
            />
            <NumberField
              label="Traversals"
              value={animation.repeat}
              min={1}
              max={20}
              onChange={(repeat) => patch({ repeat }, "repeat")}
            />
          </Row>
          <NumberField
            label="Marker size"
            value={animation.size}
            min={2}
            max={64}
            onChange={(size) => patch({ size }, "size")}
          />
          <p className="text-[11px] leading-relaxed text-mist-dim">
            Only a connector shows a flow marker.
          </p>
        </>
      ) : null}
    </>
  );
}

function AddAnimationMenu({ onAdd }: { onAdd: (type: AnimationType) => void }) {
  return (
    <div className="flex items-center gap-1">
      <label className="sr-only" htmlFor="add-animation">
        Add an animation
      </label>
      <select
        id="add-animation"
        value=""
        onChange={(event) => {
          if (event.target.value) onAdd(event.target.value as AnimationType);
          event.target.value = "";
        }}
        className="h-7 rounded border border-line bg-raised pr-6 pl-2 text-[11.5px] text-mist transition-colors hover:border-line-strong hover:text-paper focus:border-amber focus:outline-none"
      >
        <option value="">Add…</option>
        {ANIMATION_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <Plus className="size-3 text-mist-dim" aria-hidden="true" />
    </div>
  );
}
