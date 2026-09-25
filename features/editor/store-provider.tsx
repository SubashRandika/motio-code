"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import type { Project } from "@/core/model";

import { createEditorStore, type EditorStore, type EditorStoreApi } from "./store";

const EditorStoreContext = createContext<EditorStoreApi | null>(null);

/**
 * Supplies an already-built store. Separated from `EditorStoreProvider` so a
 * caller that owns the store's lifetime -- a test, or a future split-view --
 * can share one instance across trees.
 */
export function EditorStoreBridge({
  store,
  children,
}: {
  store: EditorStoreApi;
  children: ReactNode;
}) {
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

/** One store instance per open project. */
export function EditorStoreProvider({
  project,
  children,
}: {
  project: Project;
  children: ReactNode;
}) {
  // Lazy initialiser: the store is built once, on the first render, and the
  // initial project is never re-read afterwards.
  const [store] = useState<EditorStoreApi>(() => createEditorStore(project));

  return <EditorStoreBridge store={store}>{children}</EditorStoreBridge>;
}

export function useEditorStore<T>(selector: (state: EditorStore) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStore must be used inside an EditorStoreProvider");
  return useStore(store, selector);
}

/** Direct access to the store API, for reading state outside of React renders. */
export function useEditorStoreApi(): EditorStoreApi {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStoreApi must be used inside an EditorStoreProvider");
  return store;
}
