"use client";

import { Input, Label, Select } from "@/components/ui/field";
import {
  ASPECT_RATIOS,
  BUILT_IN_THEMES,
  CANVAS_PRESETS,
  EXPORT_RESOLUTIONS,
  FPS_OPTIONS,
  canvasForAspectRatio,
  type Transition,
} from "@/core/model";
import { formatDuration } from "@/lib/utils/format";

import { selectActiveScene } from "./store";
import { useEditorStore } from "./store-provider";

const TRANSITION_TYPES: Transition["type"][] = ["cut", "fade", "slide", "wipe"];

export function PropertiesPanel() {
  const scene = useEditorStore(selectActiveScene);
  const canvas = useEditorStore((state) => state.project.canvas);
  const theme = useEditorStore((state) => state.project.theme);
  const exportConfig = useEditorStore((state) => state.project.export);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);

  const renameScene = useEditorStore((state) => state.renameScene);
  const setSceneDuration = useEditorStore((state) => state.setSceneDuration);
  const setSceneTransition = useEditorStore((state) => state.setSceneTransition);
  const setCanvas = useEditorStore((state) => state.setCanvas);
  const setTheme = useEditorStore((state) => state.setTheme);
  const setExport = useEditorStore((state) => state.setExport);

  const element = scene?.data.elements.find((item) => item.id === selectedElementId) ?? null;
  const transition = scene?.data.transition;

  if (!scene) return null;

  return (
    <div className="flex flex-col divide-y divide-line">
      {element ? (
        <Section title={element.name}>
          <Row label="Type" value={element.type} />
          <Row label="Position" value={`${Math.round(element.rect.x)}, ${Math.round(element.rect.y)}`} />
          <Row
            label="Size"
            value={`${Math.round(element.rect.width)} × ${Math.round(element.rect.height)}`}
          />
          <Row label="Layer" value={String(element.layer)} />
          <Row
            label="Timing"
            value={`from ${element.from} for ${element.durationInFrames ?? "rest of scene"}`}
          />
          <Row label="Animations" value={String(element.animations.length)} />
          <p className="pt-1 text-[11.5px] leading-relaxed text-mist-dim">
            Element editing arrives with the canvas tools in the next phase.
          </p>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ scene */}
      <Section title="Scene">
        <LabeledField label="Name">
          {(id) => (
            <Input
              id={id}
              value={scene.name}
              maxLength={120}
              onChange={(event) => renameScene(scene.id, event.target.value)}
            />
          )}
        </LabeledField>

        <LabeledField label="Duration (frames)">
          {(id) => (
            <div className="flex items-center gap-2">
              <Input
                id={id}
                type="number"
                min={1}
                max={108000}
                value={scene.durationInFrames}
                onChange={(event) => setSceneDuration(scene.id, Number(event.target.value))}
              />
              <span className="tabular shrink-0 text-[12px] text-mist-dim">
                {formatDuration(scene.durationInFrames, canvas.fps)}
              </span>
            </div>
          )}
        </LabeledField>

        <LabeledField label="Enters with">
          {(id) => (
            <Select
              id={id}
              value={transition?.type ?? "cut"}
              onChange={(event) => {
                const type = event.target.value as Transition["type"];
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
                );
              }}
            >
              {TRANSITION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          )}
        </LabeledField>

        {transition && transition.type !== "cut" ? (
          <LabeledField label="Transition length (frames)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={300}
                value={transition.durationInFrames}
                onChange={(event) =>
                  setSceneTransition(scene.id, {
                    ...transition,
                    durationInFrames: Math.max(1, Number(event.target.value)),
                  })
                }
              />
            )}
          </LabeledField>
        ) : null}
      </Section>

      {/* ----------------------------------------------------------- canvas */}
      <Section title="Canvas">
        <LabeledField label="Aspect ratio">
          {(id) => (
            <Select
              id={id}
              value={canvas.aspectRatio}
              onChange={(event) => {
                const next = canvasForAspectRatio(
                  event.target.value as (typeof ASPECT_RATIOS)[number],
                  canvas.fps,
                );
                setCanvas({ ...next, background: canvas.background });
              }}
            >
              {ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio} — {CANVAS_PRESETS[ratio].label}
                </option>
              ))}
            </Select>
          )}
        </LabeledField>

        <LabeledField label="Frame rate">
          {(id) => (
            <Select
              id={id}
              value={canvas.fps}
              onChange={(event) => setCanvas({ fps: Number(event.target.value) })}
            >
              {FPS_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </Select>
          )}
        </LabeledField>

        <LabeledField label="Background">
          {(id) => (
            <div className="flex items-center gap-2">
              <input
                id={id}
                type="color"
                value={canvas.background.slice(0, 7)}
                onChange={(event) => setCanvas({ background: event.target.value })}
                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-line bg-ink-sunk"
              />
              <span className="tabular text-[12px] text-mist-dim">{canvas.background}</span>
            </div>
          )}
        </LabeledField>
      </Section>

      {/* ------------------------------------------------------------ theme */}
      <Section title="Theme">
        <LabeledField label="Composition theme">
          {(id) => (
            <Select
              id={id}
              value={theme.name}
              onChange={(event) => {
                const next = BUILT_IN_THEMES.find((item) => item.name === event.target.value);
                if (next) {
                  setTheme(next);
                  setCanvas({ background: next.background });
                }
              }}
            >
              {BUILT_IN_THEMES.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </LabeledField>

        <div className="flex gap-1.5 pt-1">
          {[theme.background, theme.surface, theme.border, theme.text, theme.accent, theme.accentAlt].map(
            (color) => (
              <span
                key={color}
                title={color}
                className="size-6 rounded border border-line"
                style={{ backgroundColor: color }}
              />
            ),
          )}
        </div>
      </Section>

      {/* ----------------------------------------------------------- export */}
      <Section title="Export">
        <LabeledField label="Format">
          {(id) => (
            <Select
              id={id}
              value={exportConfig.format}
              onChange={(event) =>
                setExport({ format: event.target.value as typeof exportConfig.format })
              }
            >
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
              <option value="gif">GIF</option>
            </Select>
          )}
        </LabeledField>

        <LabeledField label="Resolution">
          {(id) => (
            <Select
              id={id}
              value={exportConfig.resolution}
              onChange={(event) =>
                setExport({ resolution: event.target.value as typeof exportConfig.resolution })
              }
            >
              {EXPORT_RESOLUTIONS.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution}
                </option>
              ))}
            </Select>
          )}
        </LabeledField>

        <p className="text-[11.5px] leading-relaxed text-mist-dim">
          Rendering arrives in a later phase. These settings are saved with the project.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 px-3 py-4">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">{title}</h2>
      {children}
    </section>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = `field-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-mist-dim">{label}</span>
      <span className="tabular truncate text-paper">{value}</span>
    </div>
  );
}
