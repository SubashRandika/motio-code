"use client";

import {
  ArrowLeft,
  Braces,
  Check,
  CloudOff,
  Loader2,
  PanelLeft,
  PanelRight,
  Redo2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { buildTimeline } from "@/core/animation";
import { canRedo, canUndo, redoLabel, undoLabel } from "@/core/editing";
import { touchProjectAction } from "@/features/projects/actions";
import { useFrameClock } from "@/features/preview/use-frame-clock";
import { cn } from "@/lib/utils/cn";

import { CanvasStage } from "./canvas-stage";
import { ConfigEditor } from "./config-editor";
import { ElementRail, LayerList } from "./element-panel";
import { PropertiesPanel } from "./properties-panel";
import { SceneList } from "./scene-list";
import { useEditorStore, useEditorStoreApi } from "./store-provider";
import { TimelinePanel } from "./timeline";
import { useAutosave } from "./use-autosave";

export function EditorShell() {
  const store = useEditorStoreApi();
  const project = useEditorStore((state) => state.project);
  const panels = useEditorStore((state) => state.panels);
  const togglePanel = useEditorStore((state) => state.togglePanel);
  const renameProject = useEditorStore((state) => state.renameProject);
  const selectScene = useEditorStore((state) => state.selectScene);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A component that already handled the key wins; the timeline scrubber
      // owns the arrows while it has focus.
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable === true;

      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const state = store.getState();

      if (meta && key === "s") {
        event.preventDefault();
        void save();
        return;
      }

      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }

      if (meta && key === "y") {
        event.preventDefault();
        state.redo();
        return;
      }

      if (typing) return;

      if (meta && key === "a") {
        event.preventDefault();
        state.selectAllElements();
        return;
      }

      if (meta && key === "d") {
        event.preventDefault();
        state.duplicateSelection();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedElementIds.length === 0) return;
        event.preventDefault();
        state.deleteSelection();
        return;
      }

      if (event.key === "Escape") {
        state.selectElement(null);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        clock.toggle();
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        state.nudgeSelection(-step, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        state.nudgeSelection(step, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        state.nudgeSelection(0, -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        state.nudgeSelection(0, step);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clock, save, store]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      {/* -------------------------------------------------------- toolbar */}
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

        <HistoryButtons />
        <SaveStatus status={status} />

        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarToggle
            label={`${panels.config ? "Hide" : "Show"} the configuration panel`}
            active={panels.config}
            onClick={() => togglePanel("config")}
          >
            <Braces className="size-4" />
          </ToolbarToggle>
          <ToolbarToggle
            label={`${panels.left ? "Hide" : "Show"} the scenes panel`}
            active={panels.left}
            onClick={() => togglePanel("left")}
          >
            <PanelLeft className="size-4" />
          </ToolbarToggle>
          <ToolbarToggle
            label={`${panels.right ? "Hide" : "Show"} the properties panel`}
            active={panels.right}
            onClick={() => togglePanel("right")}
          >
            <PanelRight className="size-4" />
          </ToolbarToggle>
          <Button size="sm" onClick={() => void save()} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        {panels.left ? (
          <aside
            aria-label="Scenes and content"
            className="flex w-60 shrink-0 flex-col divide-y divide-line overflow-y-auto border-r border-line bg-panel"
          >
            <SceneList
              onSelectScene={(sceneId) => {
                selectScene(sceneId);
                const segment = timeline.segments.find((item) => item.sceneId === sceneId);
                if (segment) clock.seek(segment.start);
              }}
            />
            <ElementRail />
            <LayerList />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <CanvasStage project={project} timeline={timeline} frame={clock.frame} />
          {panels.config ? <ConfigEditor /> : null}
          <TimelinePanel timeline={timeline} clock={clock} />
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

function HistoryButtons() {
  const history = useEditorStore((state) => state.history);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const undoable = canUndo(history);
  const redoable = canRedo(history);
  const nextUndo = undoLabel(history);
  const nextRedo = redoLabel(history);

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={undo}
        disabled={!undoable}
        aria-label={nextUndo ? `Undo ${nextUndo.toLowerCase()}` : "Undo"}
        title={nextUndo ? `Undo ${nextUndo.toLowerCase()}` : "Nothing to undo"}
        className="grid size-8 place-items-center rounded-md text-mist transition-colors hover:bg-raised hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Undo2 className="size-4" />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!redoable}
        aria-label={nextRedo ? `Redo ${nextRedo.toLowerCase()}` : "Redo"}
        title={nextRedo ? `Redo ${nextRedo.toLowerCase()}` : "Nothing to redo"}
        className="grid size-8 place-items-center rounded-md text-mist transition-colors hover:bg-raised hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Redo2 className="size-4" />
      </button>
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

function ToolbarToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors",
        active ? "bg-raised text-paper" : "text-mist hover:bg-raised hover:text-paper",
      )}
    >
      {children}
    </button>
  );
}
