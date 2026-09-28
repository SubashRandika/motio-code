"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowRight,
  Copy,
  Trash2,
} from "lucide-react";

import { useShallow } from "zustand/shallow";

import type { Alignment } from "@/core/editing";
import {
  ASPECT_RATIOS,
  BUILT_IN_THEMES,
  CANVAS_PRESETS,
  EXPORT_RESOLUTIONS,
  FPS_OPTIONS,
  canvasForAspectRatio,
  type Transition,
} from "@/core/model";
import { planRender } from "@/core/render";
import { formatDuration } from "@/lib/utils/format";

import {
  ColorField,
  NumberField,
  Row,
  Section,
  SelectField,
  TextField,
} from "./properties/controls";
import { ElementProperties } from "./properties/element-properties";
import { HELP } from "./properties/help-text";
import { selectActiveScene, selectSelectedElements } from "./store";
import { useEditorStore } from "./store-provider";

const TRANSITION_OPTIONS: { value: Transition["type"]; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "wipe", label: "Wipe" },
];

const ALIGN_BUTTONS: { alignment: Alignment; label: string; icon: typeof AlignStartVertical }[] = [
  { alignment: "left", label: "Align left", icon: AlignStartVertical },
  { alignment: "centerX", label: "Align horizontal centres", icon: AlignCenterVertical },
  { alignment: "right", label: "Align right", icon: AlignEndVertical },
  { alignment: "top", label: "Align top", icon: AlignStartHorizontal },
  { alignment: "centerY", label: "Align vertical centres", icon: AlignCenterHorizontal },
  { alignment: "bottom", label: "Align bottom", icon: AlignEndHorizontal },
];

export function PropertiesPanel() {
  const scene = useEditorStore(selectActiveScene);
  // selectSelectedElements builds a new array each call, so it needs a shallow
  // comparison -- a reference check would re-render forever.
  const selected = useEditorStore(useShallow(selectSelectedElements));
  const canvas = useEditorStore((state) => state.project.canvas);

  if (!scene) return null;

  return (
    <div className="flex flex-col divide-y divide-line">
      {selected.length > 1 ? (
        <MultiSelection
          count={selected.length}
          nodeCount={selected.filter((element) => element.type === "node").length}
        />
      ) : null}

      {selected.length === 1 ? (
        <ElementProperties
          element={selected[0]}
          fps={canvas.fps}
          sceneDurationInFrames={scene.durationInFrames}
        />
      ) : null}

      {selected.length === 0 ? <SceneProperties /> : null}

      <CanvasProperties />
      <ThemeProperties />
      <ExportProperties />
    </div>
  );
}

function MultiSelection({ count, nodeCount }: { count: number; nodeCount: number }) {
  const alignSelection = useEditorStore((state) => state.alignSelection);
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const connectSelection = useEditorStore((state) => state.connectSelection);

  return (
    <Section title={`${count} elements selected`}>
      {nodeCount > 1 ? (
        <button
          type="button"
          onClick={connectSelection}
          className="flex items-center justify-center gap-1.5 rounded border border-cyan-deep/50 bg-cyan-wash py-1.5 text-[12px] text-cyan transition-colors hover:border-cyan"
        >
          <ArrowRight className="size-3" />
          Connect {nodeCount} nodes in order
        </button>
      ) : null}

      <div className="grid grid-cols-6 gap-1">
        {ALIGN_BUTTONS.map(({ alignment, label, icon: Icon }) => (
          <button
            key={alignment}
            type="button"
            onClick={() => alignSelection(alignment)}
            aria-label={label}
            title={label}
            className="grid h-8 place-items-center rounded border border-line bg-raised text-mist transition-colors hover:border-line-strong hover:text-paper"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={duplicateSelection}
          className="flex flex-1 items-center justify-center gap-1.5 rounded border border-line bg-raised py-1.5 text-[12px] text-mist transition-colors hover:border-line-strong hover:text-paper"
        >
          <Copy className="size-3" />
          Duplicate
        </button>
        <button
          type="button"
          onClick={deleteSelection}
          className="flex flex-1 items-center justify-center gap-1.5 rounded border border-line bg-raised py-1.5 text-[12px] text-mist transition-colors hover:border-danger/50 hover:bg-danger-wash hover:text-danger"
        >
          <Trash2 className="size-3" />
          Delete
        </button>
      </div>
    </Section>
  );
}

function SceneProperties() {
  const scene = useEditorStore(selectActiveScene);
  const fps = useEditorStore((state) => state.project.canvas.fps);
  const renameScene = useEditorStore((state) => state.renameScene);
  const setSceneDuration = useEditorStore((state) => state.setSceneDuration);
  const setSceneTransition = useEditorStore((state) => state.setSceneTransition);

  if (!scene) return null;
  const transition = scene.data.transition;

  return (
    <Section title="Scene">
      <TextField
        label="Name"
        help={HELP.sceneName}
        value={scene.name}
        maxLength={120}
        onChange={(name) => renameScene(scene.id, name)}
      />

      <Row>
        <NumberField
          label="Duration"
          help={HELP.sceneDuration}
          value={scene.durationInFrames}
          min={1}
          max={108000}
          suffix="f"
          onChange={(duration) => setSceneDuration(scene.id, duration)}
        />
        <div className="flex flex-col justify-end pb-2.5">
          <span className="tabular text-[12px] text-mist-dim">
            {formatDuration(scene.durationInFrames, fps)}
          </span>
        </div>
      </Row>

      <SelectField
        label="Enters with"
        help={HELP.sceneTransition}
        value={transition?.type ?? "cut"}
        options={TRANSITION_OPTIONS}
        onChange={(type) =>
          setSceneTransition(
            scene.id,
            type === "cut"
              ? { type: "cut", durationInFrames: 0, direction: "left", easing: "easeInOut" }
              : {
                  type,
                  durationInFrames: transition?.durationInFrames || 15,
                  direction: transition?.direction ?? "left",
                  easing: transition?.easing ?? "easeInOut",
                },
          )
        }
      />

      {transition && transition.type !== "cut" ? (
        <NumberField
          label="Transition length"
          help={HELP.transitionLength}
          value={transition.durationInFrames}
          min={1}
          max={300}
          suffix="f"
          onChange={(durationInFrames) =>
            setSceneTransition(scene.id, { ...transition, durationInFrames })
          }
        />
      ) : null}
    </Section>
  );
}

function CanvasProperties() {
  const canvas = useEditorStore((state) => state.project.canvas);
  const setCanvas = useEditorStore((state) => state.setCanvas);

  return (
    <Section title="Canvas">
      <SelectField
        label="Aspect ratio"
        help={HELP.canvasAspectRatio}
        value={canvas.aspectRatio}
        options={ASPECT_RATIOS.map((ratio) => ({
          value: ratio,
          label: `${ratio} — ${CANVAS_PRESETS[ratio].label}`,
        }))}
        onChange={(ratio) => {
          const next = canvasForAspectRatio(ratio, canvas.fps);
          setCanvas({ ...next, background: canvas.background });
        }}
      />

      <SelectField
        label="Frame rate"
        help={HELP.canvasFps}
        value={String(canvas.fps)}
        options={FPS_OPTIONS.map((fps) => ({ value: String(fps), label: `${fps} fps` }))}
        onChange={(fps) => setCanvas({ fps: Number(fps) })}
      />

      <ColorField
        label="Background"
        help={HELP.canvasBackground}
        value={canvas.background}
        onChange={(background) => setCanvas({ background: background ?? "#000000" })}
      />
    </Section>
  );
}

function ThemeProperties() {
  const theme = useEditorStore((state) => state.project.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const setCanvas = useEditorStore((state) => state.setCanvas);

  return (
    <Section title="Theme">
      <SelectField
        label="Composition theme"
        help={HELP.compositionTheme}
        value={theme.name}
        options={BUILT_IN_THEMES.map((item) => ({ value: item.name, label: item.name }))}
        onChange={(name) => {
          const next = BUILT_IN_THEMES.find((item) => item.name === name);
          if (!next) return;
          setTheme(next);
          setCanvas({ background: next.background });
        }}
      />

      <div className="flex gap-1.5">
        {[
          theme.background,
          theme.surface,
          theme.border,
          theme.text,
          theme.accent,
          theme.accentAlt,
        ].map((color) => (
          <span
            key={color}
            title={color}
            className="size-6 rounded border border-line"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </Section>
  );
}

function ExportProperties() {
  const project = useEditorStore((state) => state.project);
  const exportConfig = project.export;
  const setExport = useEditorStore((state) => state.setExport);

  const plan = planRender(project, exportConfig);

  return (
    <Section title="Export">
      <Row>
        <SelectField
          label="Format"
          help={HELP.exportFormat}
          value={exportConfig.format}
          options={[
            { value: "mp4" as const, label: "MP4" },
            { value: "webm" as const, label: "WebM" },
            { value: "gif" as const, label: "GIF" },
          ]}
          onChange={(format) => setExport({ format })}
        />
        <SelectField
          label="Resolution"
          help={HELP.exportResolution}
          value={exportConfig.resolution}
          options={EXPORT_RESOLUTIONS.map((resolution) => ({
            value: resolution,
            label: resolution,
          }))}
          onChange={(resolution) => setExport({ resolution })}
        />
      </Row>

      <Row>
        <SelectField
          label="Aspect ratio"
          help={HELP.exportAspectRatio}
          value={exportConfig.aspectRatio}
          options={ASPECT_RATIOS.map((aspectRatio) => ({
            value: aspectRatio,
            label: aspectRatio === project.canvas.aspectRatio ? `${aspectRatio} (canvas)` : aspectRatio,
          }))}
          onChange={(aspectRatio) => setExport({ aspectRatio })}
        />
        <SelectField
          label="Frame rate"
          help={HELP.exportFps}
          value={String(exportConfig.fps)}
          options={FPS_OPTIONS.map((fps) => ({ value: String(fps), label: `${fps} fps` }))}
          onChange={(fps) => setExport({ fps: Number(fps) })}
        />
      </Row>

      <p className="tabular text-[11.5px] leading-relaxed text-mist-dim">
        {plan.width}×{plan.height} · {plan.durationInFrames} frames ·{" "}
        {formatDuration(plan.durationInFrames, plan.fps)}
      </p>

      {plan.letterboxed ? (
        <p className="text-[11.5px] leading-relaxed text-amber">
          Composed at {project.canvas.aspectRatio}, so it is scaled to fit and centred rather than
          cropped.
        </p>
      ) : null}
    </Section>
  );
}
