"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import {
  rectFromPoints,
  rectsIntersect,
  resizeRect,
  roundRect,
  snapRect,
  translateRect,
  type ResizeHandle,
  type SnapGuide,
} from "@/core/editing";
import { anchorPoint } from "@/core/diagram";
import {
  isNode,
  type CanvasConfig,
  type NodeSide,
  type Rect,
  type SceneElement,
} from "@/core/model";

import type { PendingConnection } from "./selection-overlay";

import { useEditorStore } from "./store-provider";

type Gesture =
  | { kind: "idle" }
  | {
      kind: "move";
      /** Canvas coordinates where the drag started. */
      originX: number;
      originY: number;
      /** Rects as they were when the drag began, keyed by element id. */
      startRects: Map<string, Rect>;
      /** The element under the pointer; it drives snapping for the group. */
      primaryId: string;
      undoKey: string;
      moved: boolean;
    }
  | {
      kind: "resize";
      originX: number;
      originY: number;
      handle: ResizeHandle;
      elementId: string;
      startRect: Rect;
      undoKey: string;
    }
  | { kind: "marquee"; originX: number; originY: number; additive: boolean }
  | { kind: "connect"; sourceId: string; sourceSide: NodeSide };

export interface CanvasInteraction {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Marquee rect in canvas units, while one is being dragged. */
  marquee: Rect | null;
  guides: SnapGuide[];
  /** The connector being drawn, while a nub is being dragged. */
  pending: PendingConnection | null;
  dragging: boolean;
}

const SNAP_THRESHOLD_CANVAS_UNITS = 8;

/**
 * Turns pointer events on the stage into element edits.
 *
 * Everything is computed in *canvas units*, never screen pixels, so a drag
 * means the same thing at any zoom level and the resulting coordinates are
 * identical to what a render at another resolution will use.
 */
export function useCanvasInteraction({
  stageRef,
  scale,
  canvas,
  elements,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  canvas: CanvasConfig;
  elements: SceneElement[];
}): CanvasInteraction {
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds);
  const selectElement = useEditorStore((state) => state.selectElement);
  const selectElements = useEditorStore((state) => state.selectElements);
  const setElementRects = useEditorStore((state) => state.setElementRects);
  const connectNodes = useEditorStore((state) => state.connectNodes);

  const gesture = useRef<Gesture>({ kind: "idle" });
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [dragging, setDragging] = useState(false);

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = stageRef.current?.getBoundingClientRect();
      if (!bounds) return { x: 0, y: 0 };
      return {
        x: (clientX - bounds.left) / scale,
        y: (clientY - bounds.top) / scale,
      };
    },
    [scale, stageRef],
  );

  /**
   * Topmost node under a canvas point. Uses the stored rects rather than the
   * DOM, because during a connect drag the overlay sits above the stage and
   * would swallow an `elementFromPoint` hit.
   */
  const nodeAt = useCallback(
    (point: { x: number; y: number }, excludeId?: string) =>
      [...elements]
        .filter(isNode)
        .filter((node) => node.id !== excludeId && !node.hidden)
        .sort((a, b) => b.layer - a.layer)
        .find(
          (node) =>
            point.x >= node.rect.x &&
            point.x <= node.rect.x + node.rect.width &&
            point.y >= node.rect.y &&
            point.y <= node.rect.y + node.rect.height,
        ) ?? null,
    [elements],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      const target = event.target as HTMLElement;
      const point = toCanvasPoint(event.clientX, event.clientY);
      event.currentTarget.setPointerCapture(event.pointerId);

      // 1. A connect nub starts drawing a connector.
      const nubEl = target.closest<HTMLElement>("[data-connect-nub]");
      if (nubEl) {
        const sourceSide = nubEl.dataset.connectNub as NodeSide;
        const sourceId = nubEl.dataset.connectSource ?? "";
        const source = elements.find((item) => item.id === sourceId);

        if (source && isNode(source)) {
          gesture.current = { kind: "connect", sourceId, sourceSide };
          setPending({ from: anchorPoint(source.rect, sourceSide), to: point, targetRect: null });
          setDragging(true);
        }
        return;
      }

      // 2. A resize handle takes priority over everything beneath it.
      const handleEl = target.closest<HTMLElement>("[data-resize-handle]");
      if (handleEl) {
        const handle = handleEl.dataset.resizeHandle as ResizeHandle;
        const elementId = handleEl.dataset.resizeTarget ?? "";
        const element = elements.find((item) => item.id === elementId);
        if (element) {
          gesture.current = {
            kind: "resize",
            originX: point.x,
            originY: point.y,
            handle,
            elementId,
            startRect: element.rect,
            undoKey: `resize:${elementId}:${Date.now()}`,
          };
          setDragging(true);
        }
        return;
      }

      // 3. An element under the pointer starts a move.
      const elementEl = target.closest<HTMLElement>("[data-element-id]");
      const elementId = elementEl?.dataset.elementId;
      const element = elementId ? elements.find((item) => item.id === elementId) : undefined;

      // A connector has no box of its own: it is selectable, but it follows the
      // nodes it joins rather than being dragged.
      if (element && element.type === "connector") {
        selectElement(element.id, { additive: event.shiftKey });
        gesture.current = { kind: "idle" };
        return;
      }

      if (element && !element.locked) {
        const alreadySelected = selectedElementIds.includes(element.id);
        let ids = selectedElementIds;

        if (event.shiftKey) {
          selectElement(element.id, { additive: true });
          ids = alreadySelected
            ? selectedElementIds.filter((id) => id !== element.id)
            : [...selectedElementIds, element.id];
        } else if (!alreadySelected) {
          selectElement(element.id);
          ids = [element.id];
        }

        const startRects = new Map(
          elements
            .filter(
              (item) => ids.includes(item.id) && !item.locked && item.type !== "connector",
            )
            .map((item) => [item.id, item.rect] as const),
        );

        if (startRects.size > 0) {
          gesture.current = {
            kind: "move",
            originX: point.x,
            originY: point.y,
            startRects,
            primaryId: element.id,
            undoKey: `move:${Date.now()}`,
            moved: false,
          };
          setDragging(true);
        }
        return;
      }

      // 4. Empty canvas starts a marquee.
      if (!event.shiftKey) selectElement(null);
      gesture.current = {
        kind: "marquee",
        originX: point.x,
        originY: point.y,
        additive: event.shiftKey,
      };
      setMarquee({ x: point.x, y: point.y, width: 1, height: 1 });
    },
    [elements, selectElement, selectedElementIds, toCanvasPoint],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      if (current.kind === "idle") return;

      const point = toCanvasPoint(event.clientX, event.clientY);

      if (current.kind === "move") {
        const rawDx = point.x - current.originX;
        const rawDy = point.y - current.originY;

        const primaryStart = current.startRects.get(current.primaryId);
        if (!primaryStart) return;

        let dx = rawDx;
        let dy = rawDy;
        let nextGuides: SnapGuide[] = [];

        // Alt disables snapping, the usual escape hatch for fine placement.
        if (!event.altKey) {
          const others = elements
            .filter((item) => !current.startRects.has(item.id))
            .map((item) => item.rect);

          const snapped = snapRect(
            translateRect(primaryStart, rawDx, rawDy),
            others,
            canvas,
            SNAP_THRESHOLD_CANVAS_UNITS,
          );

          dx = snapped.rect.x - primaryStart.x;
          dy = snapped.rect.y - primaryStart.y;
          nextGuides = snapped.guides;
        }

        setGuides(nextGuides);
        gesture.current = { ...current, moved: true };

        setElementRects(
          [...current.startRects].map(([id, rect]) => ({
            id,
            rect: roundRect(translateRect(rect, dx, dy)),
          })),
          { coalesceKey: current.undoKey, coalesceWindowMs: Infinity },
        );
        return;
      }

      if (current.kind === "resize") {
        const dx = point.x - current.originX;
        const dy = point.y - current.originY;

        let rect = resizeRect(current.startRect, current.handle, dx, dy, {
          preserveAspectRatio: event.shiftKey,
        });

        if (!event.altKey) {
          const others = elements
            .filter((item) => item.id !== current.elementId)
            .map((item) => item.rect);
          const snapped = snapRect(rect, others, canvas, SNAP_THRESHOLD_CANVAS_UNITS);
          rect = snapped.rect;
          setGuides(snapped.guides);
        } else {
          setGuides([]);
        }

        setElementRects([{ id: current.elementId, rect: roundRect(rect) }], {
          coalesceKey: current.undoKey,
          coalesceWindowMs: Infinity,
        });
        return;
      }

      if (current.kind === "connect") {
        const source = elements.find((item) => item.id === current.sourceId);
        if (!source) return;

        const hovered = nodeAt(point, current.sourceId);
        setPending({
          from: anchorPoint(source.rect, current.sourceSide),
          to: point,
          targetRect: hovered?.rect ?? null,
        });
        return;
      }

      if (current.kind === "marquee") {
        setMarquee(rectFromPoints(current.originX, current.originY, point.x, point.y));
      }
    },
    [canvas, elements, nodeAt, setElementRects, toCanvasPoint],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = gesture.current;

      if (current.kind === "marquee" && marquee) {
        const hits = elements
          .filter((element) => !element.locked && rectsIntersect(element.rect, marquee))
          .map((element) => element.id);

        selectElements(
          current.additive ? [...new Set([...selectedElementIds, ...hits])] : hits,
        );
      }

      if (current.kind === "connect") {
        const point = toCanvasPoint(event.clientX, event.clientY);
        const targetNode = nodeAt(point, current.sourceId);

        if (targetNode) {
          connectNodes(current.sourceId, targetNode.id, { source: current.sourceSide });
        }
      }

      gesture.current = { kind: "idle" };
      setPending(null);
      setMarquee(null);
      setGuides([]);
      setDragging(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [connectNodes, elements, marquee, nodeAt, selectElements, selectedElementIds, toCanvasPoint],
  );

  return { onPointerDown, onPointerMove, onPointerUp, marquee, guides, pending, dragging };
}
