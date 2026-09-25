"use client";

import { ArrowLeft, Check, CloudOff, Loader2, PanelLeft, PanelRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { buildTimeline } from "@/core/animation";
import { touchProjectAction } from "@/features/projects/actions";
import { useFrameClock } from "@/features/preview/use-frame-clock";
import { cn } from "@/lib/utils/cn";

import { CanvasStage } from "./canvas-stage";
import { PropertiesPanel } from "./properties-panel";
import { SceneList } from "./scene-list";
import { useEditorStore, useEditorStoreApi } from "./store-provider";
import { TimelinePanel } from "./timeline";
import { useAutosave } from "./use-autosave";

export function EditorShell() {
  const store = useEditorStoreApi();
  const project = useEditorStore((state) => state.project);
  const selectedSceneId = useEditorStore((state) => state.selectedSceneId);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const selectScene = useEditorStore((state) => state.selectScene);
  const selectElement = useEditorStore((state) => state.selectElement);
  const renameProject = useEditorStore((state) => state.renameProject);

  const { save, status } = useAutosave();

  const timeline = useMemo(() => buildTimeline(project.scenes), [project.scenes]);
  const clock = useFrameClock({
    fps: project.canvas.fps,
    durationInFrames: timeline.durationInFrames,
  });

  // Record the visit so "resume where you left off" stays accurate.
  useEffect(() => {
    void touchProjectAction(project.id);
  }, [project.id]);

  // Shortcuts, ignored while the user is typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }

      if (typing) return;

      if (event.code === "Space") {
        event.preventDefault();
        clock.toggle();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clock, save]);

  const panels = useEditorStore((state) => state.panels);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      {/* ---------------------------------------------------------- toolbar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
        <Link
          href="/dashboard"
          aria-label="Back to projects"
          className="grid size-8 place-items-center rounded-md text-mist transition-colors hover:bg-raised hover:text-paper"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <label className="sr-only" htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          value={project.name}
          maxLength={120}
          onChange={(event) => renameProject(event.target.value)}
          className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] font-medium text-paper transition-colors hover:border-line focus:border-amber focus:outline-none"
        />

        <SaveStatus status={status} />

        <div className="ml-auto flex items-center gap-1.5">
          <PanelToggle
            side="left"
            active={panels.left}
            onClick={() =>
              store.setState((state) => ({ panels: { ...state.panels, left: !state.panels.left } }))
            }
          />
          <PanelToggle
            side="right"
            active={panels.right}
            onClick={() =>
              store.setState((state) => ({
                panels: { ...state.panels, right: !state.panels.right },
              }))
            }
          />
          <Button size="sm" onClick={() => void save()} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        {panels.left ? (
          <aside
            aria-label="Scenes and content"
            className="w-60 shrink-0 overflow-y-auto border-r border-line bg-panel"
          >
            <SceneList onSelectScene={(sceneId) => {
              selectScene(sceneId);
              const segment = timeline.segments.find((item) => item.sceneId === sceneId);
              if (segment) clock.seek(segment.start);
            }} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <CanvasStage
            project={project}
            timeline={timeline}
            frame={clock.frame}
            selectedElementId={selectedElementId}
            onSelectElement={selectElement}
          />

          <TimelinePanel
            project={project}
            timeline={timeline}
            clock={clock}
            activeSceneId={selectedSceneId}
            selectedElementId={selectedElementId}
            onSelectScene={selectScene}
            onSelectElement={selectElement}
          />
        </div>

        {panels.right ? (
          <aside
            aria-label="Properties"
            className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel"
          >
            <PropertiesPanel />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function SaveStatus({ status }: { status: ReturnType<typeof useAutosave>["status"] }) {
  const saveError = useEditorStore((state) => state.saveError);

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-mist">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        Saving
      </span>
    );
  }

  if (status === "error") {
    return (
      <span role="alert" className="flex items-center gap-1.5 text-[12px] text-danger">
        <CloudOff className="size-3" aria-hidden="true" />
        {saveError ?? "Could not save"}
      </span>
    );
  }

  if (status === "dirty") {
    return <span className="text-[12px] text-mist-dim">Unsaved changes</span>;
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-mist">
        <Check className="size-3 text-ok" aria-hidden="true" />
        Saved
      </span>
    );
  }

  return null;
}

function PanelToggle({
  side,
  active,
  onClick,
}: {
  side: "left" | "right";
  active: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? PanelLeft : PanelRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${active ? "Hide" : "Show"} the ${side === "left" ? "scenes" : "properties"} panel`}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors",
        active ? "bg-raised text-paper" : "text-mist hover:bg-raised hover:text-paper",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
