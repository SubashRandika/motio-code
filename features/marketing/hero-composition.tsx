"use client";

import { Pause, Play } from "lucide-react";

import { formatTimecode, interpolate } from "@/core/animation";
import { useFrameClock } from "@/features/preview/use-frame-clock";
import { cn } from "@/lib/utils/cn";

const FPS = 30;
const DURATION = 200;

/**
 * The demo composition is a real MotioCode timeline: one scene, four elements,
 * every value derived from the current frame by the same `interpolate` the
 * editor and the renderer use. Nothing here is a CSS keyframe, which is the
 * point -- a CSS animation cannot be seeked, and cannot be rendered to video.
 */
type Tone = "plain" | "keyword" | "string" | "fn" | "comment" | "punct";

const CODE: { indent: number; tokens: [string, Tone][] }[] = [
  { indent: 0, tokens: [["export async function ", "keyword"], ["handler", "fn"], ["(req: Request) {", "punct"]] },
  { indent: 1, tokens: [["const ", "keyword"], ["token = req.headers.", "plain"], ["get", "fn"], ["(", "punct"], ['"authorization"', "string"], [") ", "punct"]] },
  { indent: 1, tokens: [["const ", "keyword"], ["session = ", "plain"], ["await ", "keyword"], ["verify", "fn"], ["(token)", "punct"]] },
  { indent: 0, tokens: [["", "plain"]] },
  { indent: 1, tokens: [["if ", "keyword"], ["(!session) {", "punct"]] },
  { indent: 2, tokens: [["return ", "keyword"], ["unauthorized", "fn"], ["(", "punct"], ["401", "string"], [")", "punct"]] },
  { indent: 1, tokens: [["}", "punct"]] },
  { indent: 0, tokens: [["", "plain"]] },
  { indent: 1, tokens: [["return ", "keyword"], ["render", "fn"], ["(session.projectId)", "punct"]] },
  { indent: 0, tokens: [["}", "punct"]] },
];

const TONE_CLASS: Record<Tone, string> = {
  plain: "text-paper/85",
  keyword: "text-[#C698F0]",
  string: "text-[#8FD98F]",
  fn: "text-cyan",
  comment: "text-mist-dim",
  punct: "text-mist",
};

/** The element track summary drawn under the composition. */
const CLIPS = [
  { label: "Panel", from: 0, to: 200, accent: false },
  { label: "Code reveal", from: 12, to: 120, accent: false },
  { label: "Highlight", from: 112, to: 152, accent: true },
  { label: "Callout", from: 126, to: 200, accent: false },
];

export function HeroComposition() {
  const clock = useFrameClock({ fps: FPS, durationInFrames: DURATION, loop: true, autoPlay: true });
  const { frame } = clock;

  const panelOpacity = interpolate(frame, [0, 14], [0, 1], { easing: "easeOut" });
  const panelLift = interpolate(frame, [0, 22], [18, 0], { easing: "easeOut" });
  const linesShown = interpolate(frame, [12, 120], [0, CODE.length], { easing: "linear" });
  const highlight = Math.sin(Math.PI * interpolate(frame, [112, 152], [0, 1]));
  const calloutOpacity = interpolate(frame, [126, 144], [0, 1], { easing: "easeOut" });
  const calloutSlide = interpolate(frame, [126, 150], [24, 0], { easing: "easeOut" });
  const playheadPercent = (frame / (DURATION - 1)) * 100;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-panel border border-line bg-panel"
        style={{ opacity: panelOpacity, transform: `translateY(${panelLift}px)` }}
      >
        <div className="flex items-center gap-2 border-b border-line bg-ink-sunk px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="tabular ml-2 text-[11px] text-mist-dim">auth/handler.ts</span>
        </div>

        <pre className="tabular overflow-x-auto px-4 py-4 text-[12.5px] leading-[1.75] sm:text-[13.5px]">
          <code>
            {CODE.map((line, index) => {
              const progress = Math.min(1, Math.max(0, linesShown - index));
              const isHighlighted = index === 5;
              return (
                <div
                  key={index}
                  className="relative flex"
                  style={{
                    opacity: progress,
                    transform: `translateX(${(1 - progress) * 10}px)`,
                  }}
                >
                  {isHighlighted && highlight > 0.01 ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 -inset-x-2 rounded-sm bg-amber"
                      style={{ opacity: highlight * 0.16 }}
                    />
                  ) : null}
                  <span className="relative w-7 shrink-0 text-right text-mist-dim select-none">
                    {index + 1}
                  </span>
                  <span className="relative pl-4" style={{ paddingLeft: `${16 + line.indent * 18}px` }}>
                    {line.tokens.map(([text, tone], tokenIndex) => (
                      <span key={tokenIndex} className={TONE_CLASS[tone]}>
                        {text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>

        <div
          className="absolute right-4 bottom-4 max-w-[62%] rounded-md border border-amber/35 bg-amber-wash px-3 py-2"
          style={{ opacity: calloutOpacity, transform: `translateX(${calloutSlide}px)` }}
        >
          <p className="tabular text-[10px] tracking-[0.14em] text-amber uppercase">Callout</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-paper">
            Every request that fails verification stops here.
          </p>
        </div>
      </div>

      <HeroTransport clock={clock} playheadPercent={playheadPercent} />
      <figcaption className="sr-only">
        A code panel revealing line by line, with a highlighted line and an explanatory callout,
        scrubbed by a timeline playhead.
      </figcaption>
    </figure>
  );
}

function HeroTransport({
  clock,
  playheadPercent,
}: {
  clock: ReturnType<typeof useFrameClock>;
  playheadPercent: number;
}) {
  return (
    <div className="rounded-panel border border-line bg-panel/60 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={clock.toggle}
          aria-label={clock.playing ? "Pause the demo" : "Play the demo"}
          className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-raised text-paper transition-colors hover:border-line-strong"
        >
          {clock.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>

        <div className="tabular flex items-baseline gap-2 text-[11px]">
          <span className="text-cyan">{formatTimecode(clock.frame, FPS)}</span>
          <span className="text-mist-dim">/ {formatTimecode(DURATION - 1, FPS)}</span>
        </div>

        <span className="tabular ml-auto text-[11px] text-mist-dim">
          frame {clock.frame.toString().padStart(3, "0")} · {FPS}fps
        </span>
      </div>

      <div className="relative mt-3 space-y-1">
        {CLIPS.map((clip) => (
          <div key={clip.label} className="relative h-5 overflow-hidden rounded-sm bg-ink-sunk">
            <div
              className={cn(
                "absolute inset-y-0 flex items-center rounded-sm border px-2",
                clip.accent
                  ? "border-amber/40 bg-amber-wash text-amber"
                  : "border-line-strong bg-raised text-mist",
              )}
              style={{
                left: `${(clip.from / DURATION) * 100}%`,
                width: `${((clip.to - clip.from) / DURATION) * 100}%`,
              }}
            >
              <span className="truncate text-[10px] tracking-wide">{clip.label}</span>
            </div>
          </div>
        ))}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-cyan"
          style={{ left: `${playheadPercent}%` }}
        >
          <span className="absolute -top-1 -left-[3px] size-[7px] rotate-45 rounded-[1px] bg-cyan" />
        </div>
      </div>
    </div>
  );
}
