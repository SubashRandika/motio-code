"use client";

import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";

import { formatDuration } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

import { useEditorStore } from "./store-provider";

export function SceneList({ onSelectScene }: { onSelectScene: (sceneId: string) => void }) {
  const scenes = useEditorStore((state) => state.project.scenes);
  const fps = useEditorStore((state) => state.project.canvas.fps);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const addScene = useEditorStore((state) => state.addScene);
  const duplicateScene = useEditorStore((state) => state.duplicateScene);
  const deleteScene = useEditorStore((state) => state.deleteScene);
  const moveScene = useEditorStore((state) => state.moveScene);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-mist-dim uppercase">
          Scenes
        </h2>
        <button
          type="button"
          onClick={addScene}
          aria-label="Add a scene"
          className="grid size-6 place-items-center rounded text-mist transition-colors hover:bg-raised hover:text-paper"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <ul className="space-y-1 px-2 pb-2">
        {scenes.map((scene, index) => {
          const selected = scene.id === selectedSceneId;
          return (
            <li key={scene.id}>
              <div
                className={cn(
                  "group rounded-md border transition-colors",
                  selected
                    ? "border-amber/50 bg-amber-wash"
                    : "border-transparent hover:border-line hover:bg-raised",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectScene(scene.id)}
                  aria-current={selected ? "true" : undefined}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                >
                  <span
                    className={cn(
                      "tabular w-5 shrink-0 text-[10px]",
                      selected ? "text-amber" : "text-mist-dim",
                    )}
                  >
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-paper">{scene.name}</span>
                    <span className="tabular block text-[10.5px] text-mist-dim">
                      {formatDuration(scene.durationInFrames, fps)} · {scene.data.elements.length}{" "}
                      {scene.data.elements.length === 1 ? "element" : "elements"}
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-0.5 border-t border-line/60 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <SceneAction
                    label={`Move ${scene.name} up`}
                    disabled={index === 0}
                    onClick={() => moveScene(scene.id, -1)}
                  >
                    <ChevronUp className="size-3" />
                  </SceneAction>
                  <SceneAction
                    label={`Move ${scene.name} down`}
                    disabled={index === scenes.length - 1}
                    onClick={() => moveScene(scene.id, 1)}
                  >
                    <ChevronDown className="size-3" />
                  </SceneAction>
                  <SceneAction
                    label={`Duplicate ${scene.name}`}
                    onClick={() => duplicateScene(scene.id)}
                  >
                    <Copy className="size-3" />
                  </SceneAction>
                  <SceneAction
                    label={`Delete ${scene.name}`}
                    disabled={scenes.length <= 1}
                    tone="danger"
                    onClick={() => deleteScene(scene.id)}
                  >
                    <Trash2 className="size-3" />
                  </SceneAction>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SceneAction({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid size-6 place-items-center rounded transition-colors disabled:opacity-30",
        tone === "danger"
          ? "text-mist hover:bg-danger-wash hover:text-danger"
          : "text-mist hover:bg-line hover:text-paper",
      )}
    >
      {children}
    </button>
  );
}
