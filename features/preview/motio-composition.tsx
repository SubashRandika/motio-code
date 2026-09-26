"use client";

import { useMemo } from "react";
import { useCurrentFrame } from "remotion";

import { buildTimeline } from "@/core/animation";
import type { Project } from "@/core/model";
import { canvasFrameFor, type RenderPlan } from "@/core/render";

import { ProjectComposition } from "./composition";

export interface MotioCompositionProps {
  project: Project;
  plan: RenderPlan;
}

/**
 * The Remotion entry point.
 *
 * Deliberately thin: it reads the frame, converts it to an authored frame, and
 * scales the canvas into the output. Everything it needs to decide has already
 * been decided by `planRender`, and everything it draws comes from
 * `ProjectComposition` -- the same tree the editor canvas draws. There is no
 * third implementation of the composition to keep in step, which is the point
 * of the split.
 *
 * Remotion asks for frames in whatever order it likes and re-mounts nothing
 * between them, so this holds no state and measures nothing.
 */
export function MotioComposition({ project, plan }: MotioCompositionProps) {
  const outputFrame = useCurrentFrame();
  const frame = canvasFrameFor(plan, outputFrame);
  const timeline = useMemo(() => buildTimeline(project.scenes), [project.scenes]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        // The bars of a letterboxed export take the canvas colour, so a project
        // exported to a shape it was not composed at still looks deliberate.
        backgroundColor: project.canvas.background,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: plan.offsetX,
          top: plan.offsetY,
          width: plan.canvasWidth,
          height: plan.canvasHeight,
          transform: `scale(${plan.scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          backgroundColor: project.canvas.background,
        }}
      >
        <ProjectComposition project={project} frame={frame} timeline={timeline} />
      </div>
    </div>
  );
}
