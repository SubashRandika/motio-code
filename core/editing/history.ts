/**
 * A bounded undo stack over whole snapshots of a value.
 *
 * Snapshots rather than inverse commands: the project model is plain data
 * updated immutably, so an untouched scene is shared between snapshots and a
 * stack entry costs little more than the parts that actually changed. It is
 * also impossible to get wrong, which matters more than the bytes.
 *
 * Framework-free on purpose -- the editor store owns *when* to record, this
 * module only owns the stack.
 */

export interface HistoryEntry<T> {
  snapshot: T;
  label: string;
  /** Edits sharing a key inside the coalesce window collapse into one step. */
  coalesceKey?: string;
  at: number;
}

export interface History<T> {
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
}

/** How many steps back a user can go. */
export const HISTORY_LIMIT = 80;

/**
 * A burst of edits closer together than this, on the same target, is one step.
 * Long enough to swallow a drag or a run of typing, short enough that a
 * deliberate pause starts a new step.
 */
export const COALESCE_WINDOW_MS = 700;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export interface RecordOptions {
  label: string;
  coalesceKey?: string;
  /**
   * Override the coalesce window. A drag passes `Infinity` with a key unique
   * to that drag, so the whole gesture is one step however long it lasts.
   */
  coalesceWindowMs?: number;
  now?: number;
}

/**
 * Records the state *before* a change.
 *
 * When the change coalesces with the previous one, the older snapshot is kept
 * -- undo should return to before the whole burst, not to the middle of it.
 */
export function record<T>(
  history: History<T>,
  previous: T,
  { label, coalesceKey, coalesceWindowMs = COALESCE_WINDOW_MS, now = Date.now() }: RecordOptions,
): History<T> {
  const top = history.past[history.past.length - 1];

  const coalesces =
    top !== undefined &&
    coalesceKey !== undefined &&
    top.coalesceKey === coalesceKey &&
    now - top.at <= coalesceWindowMs;

  if (coalesces) {
    const past = history.past.slice(0, -1);
    past.push({ ...top, at: now });
    // A new edit always invalidates the redo branch.
    return { past, future: [] };
  }

  const past = [...history.past, { snapshot: previous, label, coalesceKey, at: now }];
  if (past.length > HISTORY_LIMIT) past.shift();

  return { past, future: [] };
}

export interface HistoryStep<T> {
  history: History<T>;
  present: T;
  label: string;
}

export function undo<T>(history: History<T>, present: T): HistoryStep<T> | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, { ...entry, snapshot: present }],
    },
    present: entry.snapshot,
    label: entry.label,
  };
}

export function redo<T>(history: History<T>, present: T): HistoryStep<T> | null {
  const entry = history.future[history.future.length - 1];
  if (!entry) return null;

  return {
    history: {
      past: [...history.past, { ...entry, snapshot: present }],
      future: history.future.slice(0, -1),
    },
    present: entry.snapshot,
    label: entry.label,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

/** Label of the step undo would take, for a tooltip or menu item. */
export function undoLabel<T>(history: History<T>): string | null {
  return history.past[history.past.length - 1]?.label ?? null;
}

export function redoLabel<T>(history: History<T>): string | null {
  return history.future[history.future.length - 1]?.label ?? null;
}
