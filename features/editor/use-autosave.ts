"use client";

import { useCallback, useEffect, useRef } from "react";

import { saveProjectAction } from "@/features/projects/actions";

import { useEditorStore, useEditorStoreApi } from "./store-provider";

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Saves the working copy after the user stops editing, and exposes a manual
 * save for the toolbar and Ctrl/Cmd+S.
 *
 * The payload is built from the store at save time rather than captured in a
 * closure, so a keystroke landing mid-debounce is never lost.
 */
export function useAutosave() {
  const store = useEditorStoreApi();
  const status = useEditorStore((state) => state.status);
  const inFlight = useRef(false);

  const save = useCallback(async () => {
    if (inFlight.current) return;

    const state = store.getState();
    if (state.status === "saving") return;

    inFlight.current = true;
    state.beginSave();

    try {
      const project = store.getState().project;
      const result = await saveProjectAction({
        projectId: project.id,
        name: project.name,
        description: project.description,
        canvas: project.canvas,
        theme: project.theme,
        export: project.export,
        scenes: project.scenes.map((scene) => ({
          id: scene.id,
          name: scene.name,
          order: scene.order,
          durationInFrames: scene.durationInFrames,
          data: scene.data,
        })),
      });

      if (result.ok) {
        store.getState().saveSucceeded(result.savedAt ?? new Date().toISOString());
      } else {
        store.getState().saveFailed(result.error ?? "Could not save the project.");
      }
    } catch {
      store.getState().saveFailed("Lost connection while saving. Your changes are still here.");
    } finally {
      inFlight.current = false;
    }
  }, [store]);

  useEffect(() => {
    if (status !== "dirty") return;
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, save]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (status !== "dirty" && status !== "error") return;

    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return { save, status };
}
