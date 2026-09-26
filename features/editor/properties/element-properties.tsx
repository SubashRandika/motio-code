"use client";

import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Copy, Trash2 } from "lucide-react";

import { Label, Textarea } from "@/components/ui/field";
import {
  CODE_LANGUAGES,
  CODE_REVEAL_UNITS,
  CONNECTOR_ANCHORS,
  CONNECTOR_KINDS,
  DIAGRAM_NODE_SHAPES,
  NODE_ICONS,
  isNode,
  type CalloutElement,
  type CodeElement,
  type ConnectorElement,
  type ImageElement,
  type NodeElement,
  type SceneElement,
  type ShapeElement,
  type TextElement,
} from "@/core/model";

import { selectActiveScene } from "../store";
import { useEditorStore } from "../store-provider";
import { AnimationEditor } from "./animation-editor";
import { PresetPicker } from "./preset-picker";
import {
  ColorField,
  NumberField,
  Row,
  Section,
  SelectField,
  TextField,
  ToggleField,
} from "./controls";

export function ElementProperties({
  element,
  fps,
  sceneDurationInFrames,
}: {
  element: SceneElement;
  fps: number;
  sceneDurationInFrames: number;
}) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const setElementRects = useEditorStore((state) => state.setElementRects);
  const setElementStyle = useEditorStore((state) => state.setElementStyle);
  const setElementTiming = useEditorStore((state) => state.setElementTiming);
  const reorderElement = useEditorStore((state) => state.reorderElement);
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  const setRect = (patch: Partial<SceneElement["rect"]>, key: string) =>
    setElementRects([{ id: element.id, rect: { ...element.rect, ...patch } }], {
      coalesceKey: `rect:${element.id}:${key}`,
    });

  const runsToSceneEnd = element.durationInFrames === null;

  return (
    <>
      <Section
        title={element.type}
        action={
          <div className="flex items-center gap-0.5">
            <IconAction label="Duplicate element" onClick={duplicateSelection}>
              <Copy className="size-3" />
            </IconAction>
            <IconAction label="Delete element" tone="danger" onClick={deleteSelection}>
              <Trash2 className="size-3" />
            </IconAction>
          </div>
        }
      >
        <TextField
          label="Name"
          value={element.name}
          maxLength={120}
          onChange={(name) =>
            updateElement(element.id, (item) => ({ ...item, name }), {
              coalesceKey: `name:${element.id}`,
              label: "Rename element",
            })
          }
        />

        <div className="flex items-center gap-1">
          <Label>Layer</Label>
          <div className="ml-auto flex items-center gap-0.5">
            <IconAction label="Bring to front" onClick={() => reorderElement(element.id, "front")}>
              <ArrowUpToLine className="size-3" />
            </IconAction>
            <IconAction label="Bring forward" onClick={() => reorderElement(element.id, "forward")}>
              <ArrowUp className="size-3" />
            </IconAction>
            <IconAction label="Send backward" onClick={() => reorderElement(element.id, "backward")}>
              <ArrowDown className="size-3" />
            </IconAction>
            <IconAction label="Send to back" onClick={() => reorderElement(element.id, "back")}>
              <ArrowDownToLine className="size-3" />
            </IconAction>
          </div>
        </div>

        <Row>
          <ToggleField
            label="Locked"
            checked={element.locked}
            onChange={(locked) =>
              updateElement(element.id, (item) => ({ ...item, locked }), {
                label: locked ? "Lock element" : "Unlock element",
              })
            }
          />
          <ToggleField
            label="Hidden"
            checked={element.hidden}
            onChange={(hidden) =>
              updateElement(element.id, (item) => ({ ...item, hidden }), {
                label: hidden ? "Hide element" : "Show element",
              })
            }
          />
        </Row>
      </Section>

      {/* -------------------------------------------------------- transform */}
      {element.type === "connector" ? null : (
      <Section title="Position and size">
        <Row>
          <NumberField label="X" value={element.rect.x} onChange={(x) => setRect({ x }, "x")} />
          <NumberField label="Y" value={element.rect.y} onChange={(y) => setRect({ y }, "y")} />
        </Row>
        <Row>
          <NumberField
            label="Width"
            value={element.rect.width}
            min={1}
            onChange={(width) => setRect({ width }, "width")}
          />
          <NumberField
            label="Height"
            value={element.rect.height}
            min={1}
            onChange={(height) => setRect({ height }, "height")}
          />
        </Row>
      </Section>
      )}

      {/* ----------------------------------------------------------- timing */}
      <Section title="Timing">
        <Row>
          <NumberField
            label="Starts at"
            value={element.from}
            min={0}
            max={sceneDurationInFrames - 1}
            suffix="f"
            onChange={(from) =>
              setElementTiming(element.id, { from }, { coalesceKey: `from:${element.id}` })
            }
          />
          <NumberField
            label="Length"
            value={element.durationInFrames ?? sceneDurationInFrames - element.from}
            min={1}
            suffix="f"
            disabled={runsToSceneEnd}
            onChange={(durationInFrames) =>
              setElementTiming(
                element.id,
                { durationInFrames },
                { coalesceKey: `duration:${element.id}` },
              )
            }
          />
        </Row>

        <ToggleField
          label="Runs to the end of the scene"
          checked={runsToSceneEnd}
          onChange={(checked) =>
            setElementTiming(element.id, {
              durationInFrames: checked
                ? null
                : Math.max(1, sceneDurationInFrames - element.from),
            })
          }
        />
      </Section>

      {/* ---------------------------------------------------------- content */}
      <ContentFields element={element} />

      {/* ------------------------------------------------------------ style */}
      <Section title="Style">
        {element.type === "connector" ? (
          <ColorField
            label="Line colour"
            value={element.style.stroke}
            onChange={(stroke) =>
              setElementStyle(element.id, { stroke }, { coalesceKey: `stroke:${element.id}` })
            }
          />
        ) : (
          <>
        <ColorField
          label="Fill"
          value={element.style.fill}
          allowNone
          onChange={(fill) =>
            setElementStyle(element.id, { fill }, { coalesceKey: `fill:${element.id}` })
          }
        />
        <ColorField
          label="Border"
          value={element.style.stroke}
          allowNone
          onChange={(stroke) =>
            setElementStyle(element.id, { stroke }, { coalesceKey: `stroke:${element.id}` })
          }
        />
        <Row>
          <NumberField
            label="Border width"
            value={element.style.strokeWidth}
            min={0}
            max={64}
            onChange={(strokeWidth) =>
              setElementStyle(
                element.id,
                { strokeWidth },
                { coalesceKey: `strokeWidth:${element.id}` },
              )
            }
          />
          <NumberField
            label="Corner radius"
            value={element.style.cornerRadius}
            min={0}
            max={512}
            onChange={(cornerRadius) =>
              setElementStyle(
                element.id,
                { cornerRadius },
                { coalesceKey: `radius:${element.id}` },
              )
            }
          />
        </Row>
        <Row>
          <NumberField
            label="Padding"
            value={element.style.padding}
            min={0}
            max={512}
            onChange={(padding) =>
              setElementStyle(element.id, { padding }, { coalesceKey: `padding:${element.id}` })
            }
          />
          <NumberField
            label="Opacity"
            value={element.style.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) =>
              setElementStyle(element.id, { opacity }, { coalesceKey: `opacity:${element.id}` })
            }
          />
        </Row>
        <ToggleField
          label="Drop shadow"
          checked={element.style.shadow}
          onChange={(shadow) => setElementStyle(element.id, { shadow })}
        />
          </>
        )}
      </Section>

      <PresetPicker element={element} />
      <AnimationEditor element={element} fps={fps} />
    </>
  );
}

/* --------------------------------------------------------- content by type */

function ContentFields({ element }: { element: SceneElement }) {
  switch (element.type) {
    case "text":
      return <TextContent element={element} />;
    case "code":
      return <CodeContent element={element} />;
    case "shape":
      return <ShapeContent element={element} />;
    case "callout":
      return <CalloutContent element={element} />;
    case "image":
      return <ImageContent element={element} />;
    case "node":
      return <NodeContent element={element} />;
    case "connector":
      return <ConnectorContent element={element} />;
  }
}

function NodeContent({ element }: { element: NodeElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  const patch = (changes: Partial<NodeElement["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) =>
        item.type === "node" ? { ...item, content: { ...item.content, ...changes } } : item,
      { coalesceKey: `node:${element.id}:${key}`, label: "Edit node" },
    );

  return (
    <Section title="Node">
      <TextField
        label="Label"
        value={element.content.label}
        maxLength={200}
        onChange={(label) => patch({ label }, "label")}
      />

      <TextField
        label="Detail"
        value={element.content.sublabel}
        maxLength={200}
        placeholder="Optional second line"
        onChange={(sublabel) => patch({ sublabel }, "sublabel")}
      />

      <Row>
        <SelectField
          label="Shape"
          value={element.content.shape}
          options={DIAGRAM_NODE_SHAPES.map((shape) => ({ value: shape, label: shape }))}
          onChange={(shape) => patch({ shape }, "shape")}
        />
        <SelectField
          label="Icon"
          value={element.content.icon}
          options={NODE_ICONS.map((icon) => ({ value: icon, label: icon }))}
          onChange={(icon) => patch({ icon }, "icon")}
        />
      </Row>

      <Row>
        <NumberField
          label="Text size"
          value={element.content.fontSize}
          min={8}
          max={200}
          onChange={(fontSize) => patch({ fontSize }, "fontSize")}
        />
        <SelectField
          label="Align"
          value={element.content.align}
          options={[
            { value: "left" as const, label: "Left" },
            { value: "center" as const, label: "Center" },
            { value: "right" as const, label: "Right" },
          ]}
          onChange={(align) => patch({ align }, "align")}
        />
      </Row>

      <ColorField
        label="Accent"
        value={element.content.accent}
        allowNone
        onChange={(accent) => patch({ accent }, "accent")}
      />

      {element.content.sourceKey ? (
        <p className="text-[11.5px] leading-relaxed text-mist-dim">
          Defined in the diagram text as{" "}
          <span className="tabular text-mist">{element.content.sourceKey}</span>. Re-applying the
          text keeps this position.
        </p>
      ) : null}
    </Section>
  );
}

function ConnectorContent({ element }: { element: ConnectorElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const scene = useEditorStore(selectActiveScene);

  const patch = (changes: Partial<ConnectorElement["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) =>
        item.type === "connector" ? { ...item, content: { ...item.content, ...changes } } : item,
      { coalesceKey: `connector:${element.id}:${key}`, label: "Edit connector" },
    );

  const nameOf = (id: string) => {
    const node = scene?.data.elements.find((item) => item.id === id);
    return node && isNode(node) ? node.content.label : "missing";
  };

  const anchorOptions = CONNECTOR_ANCHORS.map((anchor) => ({ value: anchor, label: anchor }));

  return (
    <Section title="Connector">
      <p className="text-[12.5px] text-paper">
        {nameOf(element.content.sourceId)} → {nameOf(element.content.targetId)}
      </p>

      <SelectField
        label="Route"
        value={element.content.kind}
        options={CONNECTOR_KINDS.map((kind) => ({ value: kind, label: kind }))}
        onChange={(kind) => patch({ kind }, "kind")}
      />

      <Row>
        <SelectField
          label="Leaves from"
          value={element.content.sourceAnchor}
          options={anchorOptions}
          onChange={(sourceAnchor) => patch({ sourceAnchor }, "sourceAnchor")}
        />
        <SelectField
          label="Arrives at"
          value={element.content.targetAnchor}
          options={anchorOptions}
          onChange={(targetAnchor) => patch({ targetAnchor }, "targetAnchor")}
        />
      </Row>

      <TextField
        label="Label"
        value={element.content.label}
        maxLength={200}
        placeholder="yes / 200 OK / retry"
        onChange={(label) => patch({ label }, "label")}
      />

      <NumberField
        label="Thickness"
        value={element.content.thickness}
        min={1}
        max={24}
        onChange={(thickness) => patch({ thickness }, "thickness")}
      />

      <Row>
        <ToggleField
          label="Arrow at end"
          checked={element.content.endArrow}
          onChange={(endArrow) => patch({ endArrow }, "endArrow")}
        />
        <ToggleField
          label="Arrow at start"
          checked={element.content.startArrow}
          onChange={(startArrow) => patch({ startArrow }, "startArrow")}
        />
      </Row>

      <ToggleField
        label="Dashed"
        checked={element.content.dashed}
        onChange={(dashed) => patch({ dashed }, "dashed")}
      />
    </Section>
  );
}

function TextContent({ element }: { element: TextElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  const patch = (changes: Partial<TextElement["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) =>
        item.type === "text" ? { ...item, content: { ...item.content, ...changes } } : item,
      { coalesceKey: `text:${element.id}:${key}`, label: "Edit text" },
    );

  return (
    <Section title="Text">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`text-${element.id}`}>Content</Label>
        <Textarea
          id={`text-${element.id}`}
          value={element.content.text}
          maxLength={4000}
          onChange={(event) => patch({ text: event.target.value }, "content")}
        />
      </div>

      <Row>
        <SelectField
          label="Typeface"
          value={element.content.font}
          options={[
            { value: "display" as const, label: "Display" },
            { value: "sans" as const, label: "Sans" },
            { value: "mono" as const, label: "Mono" },
          ]}
          onChange={(font) => patch({ font }, "font")}
        />
        <SelectField
          label="Align"
          value={element.content.align}
          options={[
            { value: "left" as const, label: "Left" },
            { value: "center" as const, label: "Center" },
            { value: "right" as const, label: "Right" },
          ]}
          onChange={(align) => patch({ align }, "align")}
        />
      </Row>

      <Row>
        <NumberField
          label="Size"
          value={element.content.fontSize}
          min={8}
          max={400}
          onChange={(fontSize) => patch({ fontSize }, "size")}
        />
        <NumberField
          label="Weight"
          value={element.content.fontWeight}
          min={100}
          max={900}
          step={100}
          onChange={(fontWeight) => patch({ fontWeight }, "weight")}
        />
      </Row>

      <Row>
        <NumberField
          label="Line height"
          value={element.content.lineHeight}
          min={0.8}
          max={3}
          step={0.05}
          onChange={(lineHeight) => patch({ lineHeight }, "lineHeight")}
        />
        <NumberField
          label="Tracking"
          value={element.content.letterSpacing}
          min={-0.1}
          max={0.5}
          step={0.005}
          onChange={(letterSpacing) => patch({ letterSpacing }, "tracking")}
        />
      </Row>

      <ColorField
        label="Colour"
        value={element.content.color}
        onChange={(color) => patch({ color: color ?? "#FFFFFF" }, "colour")}
      />

      <ToggleField
        label="Uppercase"
        checked={element.content.uppercase}
        onChange={(uppercase) => patch({ uppercase }, "uppercase")}
      />
    </Section>
  );
}

function CodeContent({ element }: { element: CodeElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  const patch = (changes: Partial<CodeElement["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) =>
        item.type === "code" ? { ...item, content: { ...item.content, ...changes } } : item,
      { coalesceKey: `code:${element.id}:${key}`, label: "Edit code" },
    );

  const lineCount = element.content.code.split("\n").length;

  return (
    <Section title="Code">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`code-${element.id}`}>Source</Label>
        <Textarea
          id={`code-${element.id}`}
          value={element.content.code}
          maxLength={20000}
          spellCheck={false}
          rows={10}
          onChange={(event) => patch({ code: event.target.value }, "source")}
          className="tabular min-h-40 text-[12px] leading-relaxed"
        />
        <p className="tabular text-[11px] text-mist-dim">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </p>
      </div>

      <Row>
        <SelectField
          label="Language"
          value={element.content.language}
          options={CODE_LANGUAGES.map((language) => ({ value: language, label: language }))}
          onChange={(language) => patch({ language }, "language")}
        />
        <NumberField
          label="Size"
          value={element.content.fontSize}
          min={8}
          max={72}
          onChange={(fontSize) => patch({ fontSize }, "size")}
        />
      </Row>

      <TextField
        label="Title"
        value={element.content.title}
        maxLength={120}
        placeholder="example.ts"
        onChange={(title) => patch({ title }, "title")}
      />

      <TextField
        label="Highlighted lines"
        value={element.content.highlightedLines.join(", ")}
        placeholder="3, 5, 6"
        onChange={(value) => patch({ highlightedLines: parseLineList(value, lineCount) }, "lines")}
      />

      <Row>
        <ToggleField
          label="Line numbers"
          checked={element.content.showLineNumbers}
          onChange={(showLineNumbers) => patch({ showLineNumbers }, "numbers")}
        />
        <ToggleField
          label="Window bar"
          checked={element.content.showWindowChrome}
          onChange={(showWindowChrome) => patch({ showWindowChrome }, "chrome")}
        />
      </Row>

      <Row>
        <SelectField
          label="Reveal counts"
          value={element.content.revealUnit}
          options={CODE_REVEAL_UNITS.map((unit) => ({
            value: unit,
            label: unit === "line" ? "Lines" : "Characters",
          }))}
          onChange={(revealUnit) => patch({ revealUnit }, "unit")}
        />
        <ToggleField
          label="Typing caret"
          checked={element.content.showCaret}
          onChange={(showCaret) => patch({ showCaret }, "caret")}
        />
      </Row>

      <p className="text-[11px] leading-relaxed text-mist-dim">
        A reveal animation uses this. Characters give a typewriter; lines bring the code in a row at
        a time.
      </p>
    </Section>
  );
}

function ShapeContent({ element }: { element: ShapeElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  return (
    <Section title="Shape">
      <SelectField
        label="Kind"
        value={element.content.shape}
        options={[
          { value: "rectangle" as const, label: "Rectangle" },
          { value: "ellipse" as const, label: "Ellipse" },
          { value: "line" as const, label: "Line" },
        ]}
        onChange={(shape) =>
          updateElement(
            element.id,
            (item) => (item.type === "shape" ? { ...item, content: { shape } } : item),
            { label: "Change shape" },
          )
        }
      />
    </Section>
  );
}

function CalloutContent({ element }: { element: CalloutElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  const patch = (changes: Partial<CalloutElement["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) =>
        item.type === "callout" ? { ...item, content: { ...item.content, ...changes } } : item,
      { coalesceKey: `callout:${element.id}:${key}`, label: "Edit callout" },
    );

  return (
    <Section title="Callout">
      <TextField
        label="Label"
        value={element.content.label}
        maxLength={80}
        onChange={(label) => patch({ label }, "label")}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`callout-${element.id}`}>Body</Label>
        <Textarea
          id={`callout-${element.id}`}
          value={element.content.body}
          maxLength={1000}
          onChange={(event) => patch({ body: event.target.value }, "body")}
        />
      </div>

      <SelectField
        label="Tone"
        value={element.content.tone}
        options={[
          { value: "neutral" as const, label: "Neutral" },
          { value: "accent" as const, label: "Accent" },
          { value: "warning" as const, label: "Warning" },
        ]}
        onChange={(tone) => patch({ tone }, "tone")}
      />
    </Section>
  );
}

function ImageContent({ element }: { element: ImageElement }) {
  const updateElement = useEditorStore((state) => state.updateElement);

  const patch = (changes: Partial<ImageElement["content"]>, key: string) =>
    updateElement(
      element.id,
      (item) =>
        item.type === "image" ? { ...item, content: { ...item.content, ...changes } } : item,
      { coalesceKey: `image:${element.id}:${key}`, label: "Edit image" },
    );

  return (
    <Section title="Image">
      <TextField
        label="Description"
        value={element.content.alt}
        maxLength={280}
        placeholder="What the image shows"
        onChange={(alt) => patch({ alt }, "alt")}
      />
      <SelectField
        label="Fit"
        value={element.content.fit}
        options={[
          { value: "contain" as const, label: "Contain" },
          { value: "cover" as const, label: "Cover" },
        ]}
        onChange={(fit) => patch({ fit }, "fit")}
      />
      <p className="text-[11.5px] leading-relaxed text-mist-dim">
        Uploading images arrives with the asset library.
      </p>
    </Section>
  );
}

/** Parses "3, 5, 6" into unique in-range line numbers. */
function parseLineList(value: string, lineCount: number): number[] {
  const numbers = value
    .split(/[,\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((line) => Number.isInteger(line) && line >= 1 && line <= Math.max(lineCount, 1));

  return [...new Set(numbers)].sort((a, b) => a - b).slice(0, 200);
}

function IconAction({
  label,
  onClick,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        tone === "danger"
          ? "grid size-6 place-items-center rounded text-mist transition-colors hover:bg-danger-wash hover:text-danger"
          : "grid size-6 place-items-center rounded text-mist transition-colors hover:bg-line hover:text-paper"
      }
    >
      {children}
    </button>
  );
}
