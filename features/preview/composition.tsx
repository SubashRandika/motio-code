"use client";

import { buildTimeline, getActiveSegments, type Timeline } from "@/core/animation";
import {
  isConnector,
  type ConnectorElement,
  type Project,
  type SceneElement,
} from "@/core/model";

import { ErrorBoundary } from "@/components/ui/error-boundary";
import { BrokenElement } from "@/features/editor/broken-element";
import { ConnectorLayer } from "@/features/editor/connector-layer";
import { ElementView } from "@/features/editor/element-view";

/**
 * The composition: everything a project looks like at a given frame.
 *
 * This is the one tree both the editor canvas and the Remotion render draw, and
 * it is the reason they cannot disagree. It takes a project and a frame and
 * nothing else -- no store, no selection, no zoom, no refs, no measurement --
 * so the same two arguments always produce the same pixels whether the frame
 * came from a playhead, a drag of the scrubber, or a headless renderer asking
 * for frame 412 of 900 out of order.
 *
 * It lays out at the project's design resolution. Fitting that to a viewport is
 * the caller's job, which is what keeps element coordinates meaning the same
 * thing at any zoom level and at any export resolution.
 */
export function ProjectComposition({
  project,
  frame,
  timeline,
  isolateElements = false,
}: {
  project: Project;
  frame: number;
  /** Pass a memoised timeline to avoid rebuilding it on every frame. */
  timeline?: Timeline;
  /**
   * Contain a throwing element to its own box instead of letting it take the
   * composition down. The editor turns this on; a render deliberately does not.
   *
   * The two want opposite things from the same failure. In the editor, losing
   * the canvas means losing the way to repair the element that broke it, so one
   * bad box should become one bad box. In a render, a contained failure would
   * silently bake a placeholder into a video someone is about to publish -- so
   * there it should fail, loudly, where the export can report it.
   */
  isolateElements?: boolean;
}) {
  const resolved = timeline ?? buildTimeline(project.scenes);
  const active = getActiveSegments(resolved, frame);

  return (
    <>
      {active.map(({ segment, localFrame, transitionProgress }, index) => {
        const scene = project.scenes.find((item) => item.id === segment.sceneId);
        if (!scene) return null;

        // The incoming scene fades over the outgoing one during a transition.
        const isIncoming = index === active.length - 1 && active.length > 1;
        const opacity = isIncoming ? transitionProgress : 1;

        return (
          <div
            key={segment.sceneId}
            data-scene-id={scene.id}
            style={{
              position: "absolute",
              inset: 0,
              opacity,
              backgroundColor: scene.data.background ?? undefined,
            }}
          >
            <SceneLayer
              elements={scene.data.elements}
              frame={localFrame}
              sceneDurationInFrames={scene.durationInFrames}
              project={project}
              isolateElements={isolateElements}
            />
          </div>
        );
      })}
    </>
  );
}

/**
 * The composition plus the canvas it sits on, at design resolution.
 *
 * Remotion renders this directly. The editor wraps the same thing in its own
 * scaling and selection chrome.
 */
export function ProjectCanvas({
  project,
  frame,
  timeline,
}: {
  project: Project;
  frame: number;
  timeline?: Timeline;
}) {
  return (
    <div
      data-project-canvas
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: project.canvas.background,
      }}
    >
      <ProjectComposition project={project} frame={frame} timeline={timeline} />
    </div>
  );
}

interface PaintOrder {
  /** Elements below the connector layer. */
  behind: SceneElement[];
  connectors: ConnectorElement[];
  /** Elements above the connector layer, nodes among them. */
  inFront: SceneElement[];
}

/**
 * Splits a scene into paint order.
 *
 * All connectors share one SVG layer, inserted at the lowest layer any
 * connector holds. Because a compiled diagram assigns connectors lower layers
 * than its nodes, routes land behind the boxes they join -- which is what makes
 * an arrow tuck under a node's edge instead of crossing it.
 */
export function paintOrder(elements: SceneElement[]): PaintOrder {
  const sorted = [...elements].sort((a, b) => a.layer - b.layer);
  const connectors = sorted.filter(isConnector);

  if (connectors.length === 0) {
    return { behind: sorted, connectors: [], inFront: [] };
  }

  const cut = connectors[0].layer;
  return {
    behind: sorted.filter((element) => !isConnector(element) && element.layer < cut),
    connectors,
    inFront: sorted.filter((element) => !isConnector(element) && element.layer >= cut),
  };
}

export function SceneLayer({
  elements,
  frame,
  sceneDurationInFrames,
  project,
  isolateElements = false,
}: {
  elements: SceneElement[];
  frame: number;
  sceneDurationInFrames: number;
  project: Project;
  isolateElements?: boolean;
}) {
  const order = paintOrder(elements);

  const paint = (element: SceneElement) => {
    const view = (
      <ElementView
        key={element.id}
        element={element}
        frame={frame}
        sceneDurationInFrames={sceneDurationInFrames}
        theme={project.theme}
      />
    );

    if (!isolateElements) return view;

    return (
      <ErrorBoundary
        key={element.id}
        // The element object itself: the store replaces it on every edit, so
        // changing anything about a broken element makes the boundary try
        // again. Without that, fixing the element would leave the fallback in
        // place and the fix would look like it had not worked.
        resetKeys={[element]}
        fallback={() => <BrokenElement element={element} />}
      >
        {view}
      </ErrorBoundary>
    );
  };

  return (
    <>
      {order.behind.map(paint)}
      {order.connectors.length > 0 ? (
        <ConnectorLayer
          connectors={order.connectors}
          elements={elements}
          frame={frame}
          sceneDurationInFrames={sceneDurationInFrames}
          canvas={project.canvas}
          theme={project.theme}
        />
      ) : null}
      {order.inFront.map(paint)}
    </>
  );
}
