"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  CHART_ORIENTATIONS,
  COMPARISON_SIDES,
  PROGRESS_SHAPES,
  STEP_ORIENTATIONS,
  type ChartElement,
  type ComparisonElement,
  type CounterElement,
  type ProgressElement,
  type SceneElement,
  type StepsElement,
} from "@/core/model";

import { useEditorStore } from "../store-provider";
import { ColorField, NumberField, Row, Section, SelectField, TextField, ToggleField } from "./controls";

/**
 * Property panels for the infographic elements.
 *
 * Kept out of `element-properties.tsx`, which already carries five element types
 * and would have doubled in length. The list editors share `RepeatableList` so
 * adding, removing and the empty-state behaviour are the same in all three.
 */

/**
 * Edits an element's content with one undo step per burst of typing.
 *
 * The updater receives the element straight from the store rather than closing
 * over the prop, so a patch always merges into the current value. `sameType`
 * carries the one claim the compiler cannot check for itself: this panel is only
 * rendered for an element of `element`'s own type, so the element with that id
 * has that type.
 */
function useContentPatch<E extends SceneElement>(element: E) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const sameType = (item: SceneElement): item is E => item.type === element.type;

  return (changes: Partial<E["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) => (sameType(item) ? { ...item, content: { ...item.content, ...changes } } : item),
      { coalesceKey: `${element.type}:${element.id}:${key}`, label: `Edit ${element.type}` },
    );
}

/**
 * A list of sub-items inside one element's content.
 *
 * `min` is enforced here rather than by disabling the schema: a chart with no
 * bars and a process with no steps are both meaningless, so the last row cannot
 * be removed.
 */
function RepeatableList<T>({
  items,
  itemLabel,
  max,
  onAdd,
  onRemove,
  children,
}: {
  items: T[];
  itemLabel: string;
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  children: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-md border border-line bg-ink-sunk p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] tracking-[0.12em] text-mist-dim uppercase">
                {itemLabel} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={items.length <= 1}
                aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                className="grid size-6 place-items-center rounded text-mist transition-colors hover:bg-danger-wash hover:text-danger disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-mist"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="flex flex-col gap-2">{children(item, index)}</div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        disabled={items.length >= max}
        className="flex items-center justify-center gap-1.5 rounded border border-line bg-raised py-1.5 text-[12px] text-mist transition-colors hover:border-line-strong hover:text-paper disabled:opacity-40"
      >
        <Plus className="size-3" />
        Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

export function CounterContent({ element }: { element: CounterElement }) {
  const patch = useContentPatch(element);
  const { content } = element;

  return (
    <Section title="Counter">
      <Row>
        <NumberField
          label="Value"
          value={content.value}
          step={content.decimals > 0 ? 0.1 : 1}
          onChange={(value) => patch({ value }, "value")}
        />
        <NumberField
          label="Decimals"
          value={content.decimals}
          min={0}
          max={4}
          onChange={(decimals) => patch({ decimals }, "decimals")}
        />
      </Row>

      <Row>
        <TextField
          label="Prefix"
          value={content.prefix}
          maxLength={12}
          placeholder="$"
          onChange={(prefix) => patch({ prefix }, "prefix")}
        />
        <TextField
          label="Suffix"
          value={content.suffix}
          maxLength={12}
          placeholder="%"
          onChange={(suffix) => patch({ suffix }, "suffix")}
        />
      </Row>

      <TextField
        label="Label"
        value={content.label}
        maxLength={200}
        placeholder="Uptime"
        onChange={(label) => patch({ label }, "label")}
      />

      <Row>
        <NumberField
          label="Number size"
          value={content.fontSize}
          min={8}
          max={400}
          onChange={(fontSize) => patch({ fontSize }, "fontSize")}
        />
        <NumberField
          label="Label size"
          value={content.labelFontSize}
          min={8}
          max={200}
          onChange={(labelFontSize) => patch({ labelFontSize }, "labelFontSize")}
        />
      </Row>

      <Row>
        <SelectField
          label="Align"
          value={content.align}
          options={[
            { value: "left" as const, label: "Left" },
            { value: "center" as const, label: "Centre" },
            { value: "right" as const, label: "Right" },
          ]}
          onChange={(align) => patch({ align }, "align")}
        />
        <ColorField
          label="Colour"
          value={content.color}
          onChange={(color) => patch({ color: color ?? "#E8ECF2" }, "color")}
        />
      </Row>

      <ToggleField
        label="Group thousands"
        checked={content.separator}
        onChange={(separator) => patch({ separator }, "separator")}
      />

      <p className="text-[11px] leading-relaxed text-mist-dim">
        Add a Count up animation to make it count towards this value.
      </p>
    </Section>
  );
}

export function ProgressContent({ element }: { element: ProgressElement }) {
  const patch = useContentPatch(element);
  const { content } = element;

  return (
    <Section title="Progress">
      <Row>
        <NumberField
          label="Value"
          value={content.value}
          min={0}
          onChange={(value) => patch({ value }, "value")}
        />
        <NumberField
          label="Out of"
          value={content.max}
          min={0.000001}
          onChange={(max) => patch({ max }, "max")}
        />
      </Row>

      <Row>
        <SelectField
          label="Shape"
          value={content.shape}
          options={PROGRESS_SHAPES.map((shape) => ({
            value: shape,
            label: shape === "bar" ? "Bar" : "Ring",
          }))}
          onChange={(shape) => patch({ shape }, "shape")}
        />
        <NumberField
          label="Thickness"
          value={content.thickness}
          min={1}
          max={200}
          onChange={(thickness) => patch({ thickness }, "thickness")}
        />
      </Row>

      <TextField
        label="Label"
        value={content.label}
        maxLength={200}
        onChange={(label) => patch({ label }, "label")}
      />

      <Row>
        <TextField
          label="Suffix"
          value={content.suffix}
          maxLength={12}
          onChange={(suffix) => patch({ suffix }, "suffix")}
        />
        <NumberField
          label="Text size"
          value={content.fontSize}
          min={8}
          max={200}
          onChange={(fontSize) => patch({ fontSize }, "fontSize")}
        />
      </Row>

      <Row>
        <ColorField
          label="Fill"
          value={content.fill}
          allowNone
          onChange={(fill) => patch({ fill }, "fill")}
        />
        <ColorField
          label="Track"
          value={content.track}
          allowNone
          onChange={(track) => patch({ track }, "track")}
        />
      </Row>

      <ToggleField
        label="Show the value"
        checked={content.showValue}
        onChange={(showValue) => patch({ showValue }, "showValue")}
      />
    </Section>
  );
}

export function ChartContent({ element }: { element: ChartElement }) {
  const patch = useContentPatch(element);
  const { content } = element;

  const setBars = (bars: ChartElement["content"]["bars"], key: string) => patch({ bars }, key);

  return (
    <Section title="Bar chart">
      <RepeatableList
        items={content.bars}
        itemLabel="Bar"
        max={12}
        onAdd={() =>
          setBars([...content.bars, { label: `Item ${content.bars.length + 1}`, value: 0, color: null }], "add")
        }
        onRemove={(index) => setBars(content.bars.filter((_, at) => at !== index), "remove")}
      >
        {(bar, index) => (
          <>
            <Row>
              <TextField
                label="Label"
                value={bar.label}
                maxLength={80}
                onChange={(label) =>
                  setBars(
                    content.bars.map((item, at) => (at === index ? { ...item, label } : item)),
                    `label-${index}`,
                  )
                }
              />
              <NumberField
                label="Value"
                value={bar.value}
                step={content.decimals > 0 ? 0.1 : 1}
                onChange={(value) =>
                  setBars(
                    content.bars.map((item, at) => (at === index ? { ...item, value } : item)),
                    `value-${index}`,
                  )
                }
              />
            </Row>
            <ColorField
              label="Colour"
              value={bar.color}
              allowNone
              onChange={(color) =>
                setBars(
                  content.bars.map((item, at) => (at === index ? { ...item, color } : item)),
                  `color-${index}`,
                )
              }
            />
          </>
        )}
      </RepeatableList>

      <Row>
        <SelectField
          label="Bars run"
          value={content.orientation}
          options={CHART_ORIENTATIONS.map((orientation) => ({
            value: orientation,
            label: orientation === "vertical" ? "Upwards" : "Across",
          }))}
          onChange={(orientation) => patch({ orientation }, "orientation")}
        />
        <NumberField
          label="Gap"
          value={content.gap}
          min={0}
          max={200}
          onChange={(gap) => patch({ gap }, "gap")}
        />
      </Row>

      <Row>
        <NumberField
          label="Full length is"
          value={content.max ?? 0}
          min={0}
          onChange={(max) => patch({ max: max > 0 ? max : null }, "max")}
        />
        <NumberField
          label="Text size"
          value={content.fontSize}
          min={8}
          max={120}
          onChange={(fontSize) => patch({ fontSize }, "fontSize")}
        />
      </Row>
      <p className="text-[11px] leading-relaxed text-mist-dim">
        {content.max === null
          ? "Zero scales the bars to the largest value."
          : "Set to zero to scale to the largest value instead."}
      </p>

      <Row>
        <TextField
          label="Value suffix"
          value={content.suffix}
          maxLength={12}
          onChange={(suffix) => patch({ suffix }, "suffix")}
        />
        <NumberField
          label="Decimals"
          value={content.decimals}
          min={0}
          max={4}
          onChange={(decimals) => patch({ decimals }, "decimals")}
        />
      </Row>

      <ToggleField
        label="Show the values"
        checked={content.showValues}
        onChange={(showValues) => patch({ showValues }, "showValues")}
      />
    </Section>
  );
}

export function ComparisonContent({ element }: { element: ComparisonElement }) {
  const patch = useContentPatch(element);
  const { content } = element;

  const setRows = (rows: ComparisonElement["content"]["rows"], key: string) => patch({ rows }, key);

  return (
    <Section title="Comparison">
      <Row>
        <TextField
          label="Left column"
          value={content.leftTitle}
          maxLength={80}
          onChange={(leftTitle) => patch({ leftTitle }, "leftTitle")}
        />
        <TextField
          label="Right column"
          value={content.rightTitle}
          maxLength={80}
          onChange={(rightTitle) => patch({ rightTitle }, "rightTitle")}
        />
      </Row>

      <RepeatableList
        items={content.rows}
        itemLabel="Row"
        max={10}
        onAdd={() => setRows([...content.rows, { label: "", left: "", right: "" }], "add")}
        onRemove={(index) => setRows(content.rows.filter((_, at) => at !== index), "remove")}
      >
        {(row, index) => {
          const update = (changes: Partial<typeof row>, key: string) =>
            setRows(
              content.rows.map((item, at) => (at === index ? { ...item, ...changes } : item)),
              `${key}-${index}`,
            );

          return (
            <>
              <TextField
                label="Row"
                value={row.label}
                maxLength={120}
                onChange={(label) => update({ label }, "label")}
              />
              <Row>
                <TextField
                  label="Left"
                  value={row.left}
                  maxLength={120}
                  onChange={(left) => update({ left }, "left")}
                />
                <TextField
                  label="Right"
                  value={row.right}
                  maxLength={120}
                  onChange={(right) => update({ right }, "right")}
                />
              </Row>
            </>
          );
        }}
      </RepeatableList>

      <Row>
        <SelectField
          label="Favour"
          value={content.favour}
          options={COMPARISON_SIDES.map((side) => ({
            value: side,
            label: side === "none" ? "Neither" : side === "left" ? "Left" : "Right",
          }))}
          onChange={(favour) => patch({ favour }, "favour")}
        />
        <NumberField
          label="Text size"
          value={content.fontSize}
          min={8}
          max={120}
          onChange={(fontSize) => patch({ fontSize }, "fontSize")}
        />
      </Row>
    </Section>
  );
}

export function StepsContent({ element }: { element: StepsElement }) {
  const patch = useContentPatch(element);
  const { content } = element;

  const setSteps = (steps: StepsElement["content"]["steps"], key: string) => patch({ steps }, key);

  return (
    <Section title="Steps">
      <RepeatableList
        items={content.steps}
        itemLabel="Step"
        max={8}
        onAdd={() => setSteps([...content.steps, { title: "", detail: "" }], "add")}
        onRemove={(index) => setSteps(content.steps.filter((_, at) => at !== index), "remove")}
      >
        {(step, index) => {
          const update = (changes: Partial<typeof step>, key: string) =>
            setSteps(
              content.steps.map((item, at) => (at === index ? { ...item, ...changes } : item)),
              `${key}-${index}`,
            );

          return (
            <>
              <TextField
                label="Title"
                value={step.title}
                maxLength={120}
                onChange={(title) => update({ title }, "title")}
              />
              <TextField
                label="Detail"
                value={step.detail}
                maxLength={240}
                onChange={(detail) => update({ detail }, "detail")}
              />
            </>
          );
        }}
      </RepeatableList>

      <Row>
        <SelectField
          label="Laid out"
          value={content.orientation}
          options={STEP_ORIENTATIONS.map((orientation) => ({
            value: orientation,
            label: orientation === "vertical" ? "Down (process)" : "Across (timeline)",
          }))}
          onChange={(orientation) => patch({ orientation }, "orientation")}
        />
        <NumberField
          label="Title size"
          value={content.fontSize}
          min={8}
          max={120}
          onChange={(fontSize) => patch({ fontSize }, "fontSize")}
        />
      </Row>

      <Row>
        <ToggleField
          label="Numbered"
          checked={content.numbered}
          onChange={(numbered) => patch({ numbered }, "numbered")}
        />
        <ToggleField
          label="Joining line"
          checked={content.connector}
          onChange={(connector) => patch({ connector }, "connector")}
        />
      </Row>

      <NumberField
        label="Detail size"
        value={content.detailFontSize}
        min={8}
        max={120}
        onChange={(detailFontSize) => patch({ detailFontSize }, "detailFontSize")}
      />
    </Section>
  );
}
