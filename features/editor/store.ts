"use client";

import { create } from "zustand";

import {
  DEFAULT_SCENE_DURATION_IN_FRAMES,
  EMPTY_SCENE_DATA,
  createUuid,
  type CanvasConfig,
  type ExportConfig,
  type Project,
  type Scene,
  type ThemeConfig,
  type Transition,
} from "@/core/model";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface EditorState {
  /** The working copy of the persisted project. */
  project: Project;

  /** Selection and focus. */
  selectedSceneId: string;
  selectedElementId: string | null;

  /** Save and synchronisation status. */
  status: SaveStatus;
  lastSavedAt: string | null;
  saveError: string | null;

  /** Panel visibility. */
  panels: { left: boolean; right: boolean };
}

interface EditorActions {
  selectScene: (sceneId: string) => void;
  selectElement: (elementId: string | null) => void;

  renameProject: (name: string) => void;
  setCanvas: (patch: Partial<CanvasConfig>) => void;
  setTheme: (theme: ThemeConfig) => void;
  setExport: (patch: Partial<ExportConfig>) => void;

  addScene: () => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  moveScene: (sceneId: string, direction: -1 | 1) => void;
  renameScene: (sceneId: string, name: string) => void;
  setSceneDuration: (sceneId: string, durationInFrames: number) => void;
  setSceneTransition: (sceneId: string, transition: Transition | null) => void;

  beginSave: () => void;
  saveSucceeded: (savedAt: string) => void;
  saveFailed: (message: string) => void;
  resetTo: (project: Project) => void;
}

export type EditorStore = EditorState & EditorActions;

/** Any change to the project marks it dirty, unless a save is in flight. */
function touch(): Partial<EditorState> {
  return { status: "dirty", saveError: null };
}

function renumber(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => ({ ...scene, order: index }));
}

export function createEditorStore(project: Project) {
  return create<EditorStore>()((set) => ({
    project,
    selectedSceneId: project.scenes[0]?.id ?? "",
    selectedElementId: null,
    status: "idle",
    lastSavedAt: null,
    saveError: null,
    panels: { left: true, right: true },

    selectScene: (sceneId) => set({ selectedSceneId: sceneId, selectedElementId: null }),
    selectElement: (elementId) => set({ selectedElementId: elementId }),

    renameProject: (name) =>
      set((state) => ({ ...touch(), project: { ...state.project, name } })),

    setCanvas: (patch) =>
      set((state) => ({
        ...touch(),
        project: { ...state.project, canvas: { ...state.project.canvas, ...patch } },
      })),

    setTheme: (theme) =>
      set((state) => ({ ...touch(), project: { ...state.project, theme } })),

    setExport: (patch) =>
      set((state) => ({
        ...touch(),
        project: { ...state.project, export: { ...state.project.export, ...patch } },
      })),

    addScene: () =>
      set((state) => {
        const scenes = state.project.scenes;
        const scene: Scene = {
          id: createUuid(),
          name: `Scene ${scenes.length + 1}`,
          order: scenes.length,
          durationInFrames: DEFAULT_SCENE_DURATION_IN_FRAMES,
          data: { ...EMPTY_SCENE_DATA, elements: [] },
        };

        return {
          ...touch(),
          project: { ...state.project, scenes: renumber([...scenes, scene]) },
          selectedSceneId: scene.id,
          selectedElementId: null,
        };
      }),

    duplicateScene: (sceneId) =>
      set((state) => {
        const index = state.project.scenes.findIndex((scene) => scene.id === sceneId);
        if (index === -1) return {};

        const source = state.project.scenes[index];
        const copy: Scene = {
          ...source,
          id: createUuid(),
          name: `${source.name} copy`.slice(0, 120),
          data: structuredClone(source.data),
        };

        const scenes = [...state.project.scenes];
        scenes.splice(index + 1, 0, copy);

        return {
          ...touch(),
          project: { ...state.project, scenes: renumber(scenes) },
          selectedSceneId: copy.id,
        };
      }),

    deleteScene: (sceneId) =>
      set((state) => {
        // A project always keeps at least one scene.
        if (state.project.scenes.length <= 1) return {};

        const index = state.project.scenes.findIndex((scene) => scene.id === sceneId);
        if (index === -1) return {};

        const scenes = renumber(state.project.scenes.filter((scene) => scene.id !== sceneId));
        const nextSelected = scenes[Math.min(index, scenes.length - 1)];

        return {
          ...touch(),
          project: { ...state.project, scenes },
          selectedSceneId: nextSelected.id,
          selectedElementId: null,
        };
      }),

    moveScene: (sceneId, direction) =>
      set((state) => {
        const scenes = [...state.project.scenes];
        const index = scenes.findIndex((scene) => scene.id === sceneId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= scenes.length) return {};

        [scenes[index], scenes[target]] = [scenes[target], scenes[index]];

        return { ...touch(), project: { ...state.project, scenes: renumber(scenes) } };
      }),

    renameScene: (sceneId, name) =>
      set((state) => ({
        ...touch(),
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, name } : scene,
          ),
        },
      })),

    setSceneDuration: (sceneId, durationInFrames) =>
      set((state) => ({
        ...touch(),
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id === sceneId
              ? { ...scene, durationInFrames: Math.max(1, Math.round(durationInFrames)) }
              : scene,
          ),
        },
      })),

    setSceneTransition: (sceneId, transition) =>
      set((state) => ({
        ...touch(),
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, data: { ...scene.data, transition } } : scene,
          ),
        },
      })),

    beginSave: () => set({ status: "saving", saveError: null }),

    saveSucceeded: (savedAt) =>
      // A change made while the save was in flight keeps the project dirty.
      set((state) => ({
        status: state.status === "saving" ? "saved" : state.status,
        lastSavedAt: savedAt,
        saveError: null,
      })),

    saveFailed: (message) => set({ status: "error", saveError: message }),

    resetTo: (next) =>
      set({
        project: next,
        selectedSceneId: next.scenes[0]?.id ?? "",
        selectedElementId: null,
        status: "idle",
        saveError: null,
      }),
  }));
}

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

/** The scene currently being edited, or the first one as a fallback. */
export function selectActiveScene(state: EditorStore): Scene {
  return (
    state.project.scenes.find((scene) => scene.id === state.selectedSceneId) ??
    state.project.scenes[0]
  );
}
