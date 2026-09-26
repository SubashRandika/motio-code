"use client";

import { create } from "zustand";

import {
  alignRects,
  assignLayers,
  emptyHistory,
  record,
  redo as redoHistory,
  relayer,
  undo as undoHistory,
  type Alignment,
  type History,
} from "@/core/editing";
import {
  compileDiagram,
  parseDiagramSource,
  pruneDanglingConnectors,
  type DiagramParseIssue,
} from "@/core/diagram";
import { findPreset } from "@/core/presets";
import {
  DEFAULT_SCENE_DURATION_IN_FRAMES,
  EMPTY_SCENE_DATA,
  createAnimation,
  createElement,
  createUuid,
  elementStyleSchema,
  isConnector,
  isNode,
  type Animation,
  type ConnectorAnchor,
  type AnimationType,
  type CanvasConfig,
  type AddableElementType,
  type ElementStyle,
  type ExportConfig,
  type Project,
  type Rect,
  type Scene,
  type SceneData,
  type SceneElement,
  type ThemeConfig,
  type Transition,
} from "@/core/model";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface EditorState {
  /** The working copy of the persisted project. */
  project: Project;

  /** Undo stack over the project. Only persisted data is undoable. */
  history: History<Project>;

  /** Selection and focus. */
  selectedSceneId: string;
  selectedElementIds: string[];

  /** Save and synchronisation status. */
  status: SaveStatus;
  lastSavedAt: string | null;
  saveError: string | null;

  /** Panel visibility. */
  panels: { left: boolean; right: boolean; config: boolean; diagram: boolean };
}

export interface EditOptions {
  /** Edits sharing a key in quick succession collapse into one undo step. */
  coalesceKey?: string;
  /** Widen the coalesce window; a drag passes Infinity to stay one step. */
  coalesceWindowMs?: number;
}

interface EditorActions {
  selectScene: (sceneId: string) => void;
  selectElement: (elementId: string | null, options?: { additive?: boolean }) => void;
  selectElements: (elementIds: string[]) => void;
  selectAllElements: () => void;

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
  replaceSceneData: (sceneId: string, data: SceneData) => void;

  addElement: (type: AddableElementType) => void;
  updateElement: (
    elementId: string,
    updater: (element: SceneElement) => SceneElement,
    options?: EditOptions & { label?: string },
  ) => void;
  setElementRects: (updates: { id: string; rect: Rect }[], options?: EditOptions) => void;
  setElementStyle: (elementId: string, patch: Partial<ElementStyle>, options?: EditOptions) => void;
  setElementTiming: (
    elementId: string,
    patch: { from?: number; durationInFrames?: number | null },
    options?: EditOptions,
  ) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  alignSelection: (alignment: Alignment) => void;
  reorderElement: (elementId: string, move: "front" | "forward" | "backward" | "back") => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;

  /** Draws a connector between two nodes. */
  connectNodes: (
    sourceId: string,
    targetId: string,
    anchors?: { source?: ConnectorAnchor; target?: ConnectorAnchor },
  ) => void;
  /** Connects the selected nodes in selection order. Keyboard path for connecting. */
  connectSelection: () => void;
  /** Stores the diagram text without compiling it. */
  setDiagramSource: (sceneId: string, source: string) => void;
  /** Compiles the diagram text into nodes and connectors. */
  applyDiagramSource: (sceneId: string, source: string) => DiagramParseIssue[];

  addAnimation: (elementId: string, type: AnimationType) => void;
  updateAnimation: (
    elementId: string,
    animationId: string,
    patch: Partial<Animation>,
    options?: EditOptions,
  ) => void;
  removeAnimation: (elementId: string, animationId: string) => void;
  /**
   * Applies a named preset to an element. An element-scoped preset replaces
   * that element's animations; a scene-scoped one may split it into several.
   * Either way it is a single undo step.
   */
  applyPreset: (elementId: string, presetId: string) => void;

  undo: () => void;
  redo: () => void;

  togglePanel: (panel: "left" | "right" | "config" | "diagram") => void;

  beginSave: () => void;
  saveSucceeded: (savedAt: string) => void;
  saveFailed: (message: string) => void;
  resetTo: (project: Project) => void;
}

export type EditorStore = EditorState & EditorActions;

function renumber(scenes: Scene[]): Scene[] {
  return scenes.map((scene, index) => ({ ...scene, order: index }));
}

function withScene(project: Project, sceneId: string, fn: (scene: Scene) => Scene): Project {
  return {
    ...project,
    scenes: project.scenes.map((scene) => (scene.id === sceneId ? fn(scene) : scene)),
  };
}

function withElements(
  project: Project,
  sceneId: string,
  fn: (elements: SceneElement[]) => SceneElement[],
): Project {
  return withScene(project, sceneId, (scene) => ({
    ...scene,
    data: { ...scene.data, elements: fn(scene.data.elements) },
  }));
}

export function createEditorStore(project: Project) {
  return create<EditorStore>()((set, get) => {
    /**
     * The single path every project change takes: run the recipe, record the
     * previous project for undo, and mark the project dirty.
     */
    const edit = (
      label: string,
      recipe: (project: Project) => Project,
      options: EditOptions = {},
    ) =>
      set((state) => {
        const next = recipe(state.project);
        if (next === state.project) return {};

        return {
          project: next,
          history: record(state.history, state.project, {
            label,
            coalesceKey: options.coalesceKey,
            coalesceWindowMs: options.coalesceWindowMs,
          }),
          status: "dirty" as const,
          saveError: null,
        };
      });

    const activeSceneId = () => get().selectedSceneId;

    return {
      project,
      history: emptyHistory<Project>(),
      selectedSceneId: project.scenes[0]?.id ?? "",
      selectedElementIds: [],
      status: "idle",
      lastSavedAt: null,
      saveError: null,
      panels: { left: true, right: true, config: false, diagram: false },

      // ------------------------------------------------------------ selection
      selectScene: (sceneId) => set({ selectedSceneId: sceneId, selectedElementIds: [] }),

      selectElement: (elementId, options) =>
        set((state) => {
          if (elementId === null) return { selectedElementIds: [] };
          if (!options?.additive) return { selectedElementIds: [elementId] };

          return {
            selectedElementIds: state.selectedElementIds.includes(elementId)
              ? state.selectedElementIds.filter((id) => id !== elementId)
              : [...state.selectedElementIds, elementId],
          };
        }),

      selectElements: (elementIds) => set({ selectedElementIds: elementIds }),

      selectAllElements: () =>
        set((state) => {
          const scene = selectActiveScene(state);
          return { selectedElementIds: scene ? scene.data.elements.map((el) => el.id) : [] };
        }),

      // -------------------------------------------------------------- project
      renameProject: (name) =>
        edit("Rename project", (current) => ({ ...current, name }), {
          coalesceKey: "project-name",
        }),

      setCanvas: (patch) =>
        edit("Change canvas", (current) => ({
          ...current,
          canvas: { ...current.canvas, ...patch },
        })),

      setTheme: (theme) => edit("Change theme", (current) => ({ ...current, theme })),

      setExport: (patch) =>
        edit("Change export settings", (current) => ({
          ...current,
          export: { ...current.export, ...patch },
        })),

      // --------------------------------------------------------------- scenes
      addScene: () => {
        const scene: Scene = {
          id: createUuid(),
          name: `Scene ${get().project.scenes.length + 1}`,
          order: get().project.scenes.length,
          durationInFrames: DEFAULT_SCENE_DURATION_IN_FRAMES,
          data: { ...EMPTY_SCENE_DATA, elements: [] },
        };

        edit("Add scene", (current) => ({
          ...current,
          scenes: renumber([...current.scenes, scene]),
        }));

        set({ selectedSceneId: scene.id, selectedElementIds: [] });
      },

      duplicateScene: (sceneId) => {
        const source = get().project.scenes.find((scene) => scene.id === sceneId);
        if (!source) return;

        const copy: Scene = {
          ...source,
          id: createUuid(),
          name: `${source.name} copy`.slice(0, 120),
          data: structuredClone(source.data),
        };

        edit("Duplicate scene", (current) => {
          const index = current.scenes.findIndex((scene) => scene.id === sceneId);
          const scenes = [...current.scenes];
          scenes.splice(index + 1, 0, copy);
          return { ...current, scenes: renumber(scenes) };
        });

        set({ selectedSceneId: copy.id, selectedElementIds: [] });
      },

      deleteScene: (sceneId) => {
        const state = get();
        // A project always keeps at least one scene.
        if (state.project.scenes.length <= 1) return;

        const index = state.project.scenes.findIndex((scene) => scene.id === sceneId);
        if (index === -1) return;

        edit("Delete scene", (current) => ({
          ...current,
          scenes: renumber(current.scenes.filter((scene) => scene.id !== sceneId)),
        }));

        const scenes = get().project.scenes;
        set({
          selectedSceneId: scenes[Math.min(index, scenes.length - 1)].id,
          selectedElementIds: [],
        });
      },

      moveScene: (sceneId, direction) =>
        edit("Reorder scenes", (current) => {
          const scenes = [...current.scenes];
          const index = scenes.findIndex((scene) => scene.id === sceneId);
          const target = index + direction;
          if (index === -1 || target < 0 || target >= scenes.length) return current;

          [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
          return { ...current, scenes: renumber(scenes) };
        }),

      renameScene: (sceneId, name) =>
        edit(
          "Rename scene",
          (current) => withScene(current, sceneId, (scene) => ({ ...scene, name })),
          { coalesceKey: `scene-name:${sceneId}` },
        ),

      setSceneDuration: (sceneId, durationInFrames) =>
        edit(
          "Change scene duration",
          (current) =>
            withScene(current, sceneId, (scene) => ({
              ...scene,
              durationInFrames: Math.max(1, Math.round(durationInFrames)),
            })),
          { coalesceKey: `scene-duration:${sceneId}` },
        ),

      setSceneTransition: (sceneId, transition) =>
        edit("Change transition", (current) =>
          withScene(current, sceneId, (scene) => ({
            ...scene,
            data: { ...scene.data, transition },
          })),
        ),

      replaceSceneData: (sceneId, data) =>
        edit("Edit scene configuration", (current) =>
          withScene(current, sceneId, (scene) => ({ ...scene, data })),
        ),

      // ------------------------------------------------------------- elements
      addElement: (type) => {
        const state = get();
        const scene = selectActiveScene(state);
        if (!scene) return;

        const element = createElement(type, {
          canvas: state.project.canvas,
          theme: state.project.theme,
          index: scene.data.elements.length,
        });

        edit(`Add ${type}`, (current) =>
          withElements(current, scene.id, (elements) => [...elements, element]),
        );

        set({ selectedElementIds: [element.id] });
      },

      updateElement: (elementId, updater, options) =>
        edit(
          options?.label ?? "Edit element",
          (current) =>
            withElements(current, activeSceneId(), (elements) =>
              elements.map((element) => (element.id === elementId ? updater(element) : element)),
            ),
          options,
        ),

      setElementRects: (updates, options) =>
        edit(
          updates.length > 1 ? "Move elements" : "Move element",
          (current) => {
            const byId = new Map(updates.map((update) => [update.id, update.rect]));
            return withElements(current, activeSceneId(), (elements) =>
              elements.map((element) => {
                const rect = byId.get(element.id);
                return rect ? { ...element, rect } : element;
              }),
            );
          },
          options,
        ),

      setElementStyle: (elementId, patch, options) =>
        edit(
          "Change style",
          (current) =>
            withElements(current, activeSceneId(), (elements) =>
              elements.map((element) =>
                element.id === elementId
                  ? { ...element, style: { ...element.style, ...patch } }
                  : element,
              ),
            ),
          options,
        ),

      setElementTiming: (elementId, patch, options) =>
        edit(
          "Change timing",
          (current) =>
            withElements(current, activeSceneId(), (elements) =>
              elements.map((element) =>
                element.id === elementId
                  ? {
                      ...element,
                      from:
                        patch.from === undefined ? element.from : Math.max(0, Math.round(patch.from)),
                      durationInFrames:
                        patch.durationInFrames === undefined
                          ? element.durationInFrames
                          : patch.durationInFrames === null
                            ? null
                            : Math.max(1, Math.round(patch.durationInFrames)),
                    }
                  : element,
              ),
            ),
          options,
        ),

      nudgeSelection: (dx, dy) => {
        const { selectedElementIds } = get();
        if (selectedElementIds.length === 0) return;

        edit(
          "Nudge element",
          (current) =>
            withElements(current, activeSceneId(), (elements) =>
              elements.map((element) =>
                selectedElementIds.includes(element.id)
                  ? {
                      ...element,
                      rect: { ...element.rect, x: element.rect.x + dx, y: element.rect.y + dy },
                    }
                  : element,
              ),
            ),
          { coalesceKey: `nudge:${selectedElementIds.join(",")}` },
        );
      },

      alignSelection: (alignment) => {
        const state = get();
        const scene = selectActiveScene(state);
        if (!scene || state.selectedElementIds.length === 0) return;

        const selected = scene.data.elements.filter((element) =>
          state.selectedElementIds.includes(element.id),
        );
        const aligned = alignRects(
          selected.map((element) => element.rect),
          alignment,
          state.project.canvas,
        );
        const byId = new Map(selected.map((element, index) => [element.id, aligned[index]]));

        edit("Align elements", (current) =>
          withElements(current, scene.id, (elements) =>
            elements.map((element) => {
              const rect = byId.get(element.id);
              return rect
                ? { ...element, rect: { ...rect, x: Math.round(rect.x), y: Math.round(rect.y) } }
                : element;
            }),
          ),
        );
      },

      reorderElement: (elementId, move) =>
        edit("Reorder element", (current) =>
          withElements(current, activeSceneId(), (elements) => {
            const ordered = relayer(elements);
            const index = ordered.findIndex((element) => element.id === elementId);
            if (index === -1) return elements;

            const target =
              move === "front"
                ? ordered.length - 1
                : move === "back"
                  ? 0
                  : move === "forward"
                    ? Math.min(ordered.length - 1, index + 1)
                    : Math.max(0, index - 1);

            if (target === index) return elements;

            const [moved] = ordered.splice(index, 1);
            ordered.splice(target, 0, moved);
            // Number from the new array order; re-sorting here would undo the move.
            return assignLayers(ordered);
          }),
        ),

      duplicateSelection: () => {
        const state = get();
        const scene = selectActiveScene(state);
        if (!scene || state.selectedElementIds.length === 0) return;

        const selected = scene.data.elements.filter((element) =>
          state.selectedElementIds.includes(element.id),
        );

        // Copy nodes first so connectors can be repointed at the new ids.
        const idMap = new Map<string, string>(selected.map((element) => [element.id, createUuid()]));

        const copies = selected.flatMap((element): SceneElement[] => {
          const copy = {
            ...structuredClone(element),
            id: idMap.get(element.id)!,
            name: `${element.name} copy`.slice(0, 120),
            rect: { ...element.rect, x: element.rect.x + 24, y: element.rect.y + 24 },
          };

          if (!isConnector(copy)) {
            // A duplicated node is no longer the one the text defined.
            if (isNode(copy)) {
              return [{ ...copy, content: { ...copy.content, sourceKey: null } }];
            }
            return [copy];
          }

          const sourceId = idMap.get(copy.content.sourceId);
          const targetId = idMap.get(copy.content.targetId);
          // Only copy a connector when both of its nodes came along; otherwise
          // the copy would silently re-attach to the originals.
          if (!sourceId || !targetId) return [];

          return [
            {
              ...copy,
              rect: element.rect,
              content: { ...copy.content, sourceId, targetId },
            },
          ];
        });

        edit("Duplicate elements", (current) =>
          withElements(current, scene.id, (elements) => relayer([...elements, ...copies])),
        );

        set({ selectedElementIds: copies.map((element) => element.id) });
      },

      deleteSelection: () => {
        const { selectedElementIds } = get();
        if (selectedElementIds.length === 0) return;

        edit("Delete elements", (current) =>
          withElements(current, activeSceneId(), (elements) =>
            // A connector cannot outlive the nodes it joins.
            relayer(
              pruneDanglingConnectors(
                elements.filter((element) => !selectedElementIds.includes(element.id)),
              ),
            ),
          ),
        );

        set({ selectedElementIds: [] });
      },

      // -------------------------------------------------------------- diagram
      connectNodes: (sourceId, targetId, anchors) => {
        const state = get();
        const scene = selectActiveScene(state);
        if (!scene || sourceId === targetId) return;

        const nodes = scene.data.elements.filter(isNode);
        if (!nodes.some((node) => node.id === sourceId)) return;
        if (!nodes.some((node) => node.id === targetId)) return;

        // One connector per ordered pair; drawing the same link twice is almost
        // always a slip, and two identical routes are indistinguishable.
        const alreadyJoined = scene.data.elements
          .filter(isConnector)
          .some(
            (connector) =>
              connector.content.sourceId === sourceId &&
              connector.content.targetId === targetId,
          );
        if (alreadyJoined) return;

        const source = nodes.find((node) => node.id === sourceId)!;
        const target = nodes.find((node) => node.id === targetId)!;

        const connector: SceneElement = {
          id: createUuid(),
          name: `${source.content.label} to ${target.content.label}`.slice(0, 120),
          type: "connector",
          rect: { x: 0, y: 0, width: 1, height: 1 },
          layer: 0,
          from: 0,
          durationInFrames: null,
          locked: false,
          hidden: false,
          style: {
            ...elementStyleSchema.parse({}),
            stroke: state.project.theme.muted,
            strokeWidth: 2,
          },
          animations: [],
          content: {
            sourceId,
            targetId,
            sourceAnchor: anchors?.source ?? "auto",
            targetAnchor: anchors?.target ?? "auto",
            kind: "orthogonal",
            label: "",
            startArrow: false,
            endArrow: true,
            dashed: false,
            thickness: 2,
          },
        };

        edit("Connect nodes", (current) =>
          withElements(current, scene.id, (elements) =>
            // Connectors go to the back of the stack so routes sit behind boxes.
            assignLayers([connector, ...elements]),
          ),
        );

        set({ selectedElementIds: [connector.id] });
      },

      connectSelection: () => {
        const state = get();
        const scene = selectActiveScene(state);
        if (!scene) return;

        const selectedNodes = state.selectedElementIds
          .map((id) => scene.data.elements.find((element) => element.id === id))
          .filter((element): element is SceneElement => element !== undefined)
          .filter(isNode);

        // Chain them in the order they were selected.
        for (let i = 1; i < selectedNodes.length; i += 1) {
          get().connectNodes(selectedNodes[i - 1].id, selectedNodes[i].id);
        }
      },

      setDiagramSource: (sceneId, source) =>
        edit(
          "Edit diagram text",
          (current) =>
            withScene(current, sceneId, (scene) => ({
              ...scene,
              data: {
                ...scene.data,
                diagram: { source, appliedAt: scene.data.diagram?.appliedAt ?? null },
              },
            })),
          { coalesceKey: `diagram-source:${sceneId}` },
        ),

      applyDiagramSource: (sceneId, source) => {
        const state = get();
        const scene = state.project.scenes.find((item) => item.id === sceneId);
        if (!scene) return [];

        const parsed = parseDiagramSource(source);
        if (!parsed.ok) return parsed.issues;

        const { nodes, connectors } = compileDiagram(parsed.diagram, {
          canvas: state.project.canvas,
          theme: state.project.theme,
          existing: scene.data.elements,
        });

        edit("Apply diagram", (current) =>
          withScene(current, sceneId, (item) => {
            // Everything that is not part of the diagram keeps its order and
            // stays underneath it.
            const others = [...item.data.elements]
              .filter((element) => !isNode(element) && !isConnector(element))
              .sort((a, b) => a.layer - b.layer);

            return {
              ...item,
              data: {
                ...item.data,
                elements: assignLayers([...others, ...connectors, ...nodes]),
                diagram: { source, appliedAt: new Date().toISOString() },
              },
            };
          }),
        );

        set({ selectedElementIds: [] });
        return parsed.issues;
      },

      // ----------------------------------------------------------- animations
      addAnimation: (elementId, type) =>
        edit(`Add ${type} animation`, (current) =>
          withElements(current, activeSceneId(), (elements) =>
            elements.map((element) =>
              element.id === elementId
                ? { ...element, animations: [...element.animations, createAnimation(type)] }
                : element,
            ),
          ),
        ),

      updateAnimation: (elementId, animationId, patch, options) =>
        edit(
          "Change animation",
          (current) =>
            withElements(current, activeSceneId(), (elements) =>
              elements.map((element) =>
                element.id === elementId
                  ? {
                      ...element,
                      animations: element.animations.map((animation) =>
                        animation.id === animationId
                          ? ({ ...animation, ...patch } as Animation)
                          : animation,
                      ),
                    }
                  : element,
              ),
            ),
          options,
        ),

      removeAnimation: (elementId, animationId) =>
        edit("Remove animation", (current) =>
          withElements(current, activeSceneId(), (elements) =>
            elements.map((element) =>
              element.id === elementId
                ? {
                    ...element,
                    animations: element.animations.filter(
                      (animation) => animation.id !== animationId,
                    ),
                  }
                : element,
            ),
          ),
        ),


      applyPreset: (elementId, presetId) => {
        const state = get();
        const scene = selectActiveScene(state);
        const preset = findPreset(presetId);
        if (!scene || !preset) return;

        const target = scene.data.elements.find((element) => element.id === elementId);
        if (!target || !preset.appliesTo.includes(target.type)) return;

        const context = {
          canvas: state.project.canvas,
          theme: state.project.theme,
          sceneDurationInFrames: scene.durationInFrames,
          fps: state.project.canvas.fps,
        };

        if (preset.scope === "element") {
          edit(`Apply ${preset.label}`, (current) =>
            withElements(current, scene.id, (elements) =>
              elements.map((element) =>
                element.id === elementId ? preset.apply(element, context) : element,
              ),
            ),
          );
          return;
        }

        // A scene preset rewrites the list, so layers are renumbered from the
        // order it returns rather than from the numbers it inherited.
        const next = relayer(preset.apply(target, scene.data.elements, context));

        edit(`Apply ${preset.label}`, (current) =>
          withElements(current, scene.id, () => next),
        );

        const survivors = new Set(next.map((element) => element.id));
        set({
          selectedElementIds: survivors.has(elementId) ? [elementId] : [],
        });
      },

      // -------------------------------------------------------------- history
      undo: () =>
        set((state) => {
          const step = undoHistory(state.history, state.project);
          if (!step) return {};

          return {
            ...restoreSelection(state, step.present),
            project: step.present,
            history: step.history,
            status: "dirty" as const,
            saveError: null,
          };
        }),

      redo: () =>
        set((state) => {
          const step = redoHistory(state.history, state.project);
          if (!step) return {};

          return {
            ...restoreSelection(state, step.present),
            project: step.present,
            history: step.history,
            status: "dirty" as const,
            saveError: null,
          };
        }),

      // ------------------------------------------------------------- UI state
      togglePanel: (panel) =>
        set((state) => ({ panels: { ...state.panels, [panel]: !state.panels[panel] } })),

      // ----------------------------------------------------------------- save
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
          history: emptyHistory<Project>(),
          selectedSceneId: next.scenes[0]?.id ?? "",
          selectedElementIds: [],
          status: "idle",
          saveError: null,
        }),
    };
  });
}

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

/**
 * Undo can remove the scene or elements that were selected. Drop anything that
 * no longer exists rather than leaving the panels pointed at nothing.
 */
function restoreSelection(state: EditorState, next: Project) {
  const sceneExists = next.scenes.some((scene) => scene.id === state.selectedSceneId);
  const selectedSceneId = sceneExists ? state.selectedSceneId : (next.scenes[0]?.id ?? "");
  const scene = next.scenes.find((item) => item.id === selectedSceneId);
  const liveIds = new Set(scene?.data.elements.map((element) => element.id) ?? []);

  return {
    selectedSceneId,
    selectedElementIds: state.selectedElementIds.filter((id) => liveIds.has(id)),
  };
}

/** The scene currently being edited, or the first one as a fallback. */
export function selectActiveScene(state: EditorState): Scene {
  return (
    state.project.scenes.find((scene) => scene.id === state.selectedSceneId) ??
    state.project.scenes[0]
  );
}

/** The elements currently selected, in layer order. */
export function selectSelectedElements(state: EditorState): SceneElement[] {
  const scene = selectActiveScene(state);
  if (!scene) return [];
  return scene.data.elements
    .filter((element) => state.selectedElementIds.includes(element.id))
    .sort((a, b) => a.layer - b.layer);
}
