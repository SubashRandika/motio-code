import { ArrowRight, Boxes, Code2, GitBranch } from "lucide-react";
import type { Metadata } from "next";

import { LogoLink, LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { CANVAS_PRESETS, ASPECT_RATIOS } from "@/core/model/canvas";
import { HeroComposition } from "@/features/marketing/hero-composition";

export const metadata: Metadata = {
  description:
    "MotioCode turns code, architecture diagrams and technical concepts into animated video. Scene timeline, browser preview, shareable export.",
};

const STUDIOS = [
  {
    name: "Code",
    icon: Code2,
    lede: "Reveal a snippet line by line, hold on the line that matters, and caption it in place.",
    detail: "TypeScript, JavaScript, Python, C#, Java and SQL.",
    track: [
      { from: 0, to: 0.18 },
      { from: 0.18, to: 0.62 },
      { from: 0.55, to: 0.88 },
    ],
  },
  {
    name: "Diagrams",
    icon: GitBranch,
    lede: "Lay out services and connections on a canvas, or write the definition as text and let MotioCode draw it.",
    detail: "Architecture, infrastructure, flowcharts and request paths.",
    track: [
      { from: 0.04, to: 0.4 },
      { from: 0.3, to: 0.72 },
      { from: 0.64, to: 1 },
    ],
  },
  {
    name: "Infographics",
    icon: Boxes,
    lede: "Counters, bars, comparisons and step sequences that stay faithful to the numbers you typed.",
    detail: "Built for technical explanations, not marketing decks.",
    track: [
      { from: 0, to: 0.34 },
      { from: 0.24, to: 0.56 },
      { from: 0.52, to: 0.94 },
    ],
  },
];

const PRINCIPLES = [
  {
    title: "Everything is a frame number",
    body: "Animations are declared against the timeline, not tied to browser state. Frame 84 looks the same today, tomorrow, and on a render server.",
  },
  {
    title: "The preview is the composition",
    body: "What plays in the editor is the same model the exporter reads. There is no second implementation to drift out of sync.",
  },
  {
    title: "Your projects stay yours",
    body: "Every project, asset and render is scoped to your account at the database level. Nothing is public unless you publish it.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <LogoLink />
          <nav className="flex items-center gap-1 sm:gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              Start a project
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <p className="tabular flex items-center gap-2 text-[11px] tracking-[0.18em] text-mist-dim uppercase">
                <span className="h-px w-6 bg-line-strong" />
                Scene 01 · handler.ts walkthrough
              </p>

              <h1 className="mt-5 text-[2.6rem] leading-[0.98] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
                Bring Your Code and{" "}
                <span className="text-amber">Ideas to Life.</span>
              </h1>

              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mist sm:text-base">
                MotioCode is a motion-design studio for engineers. Build an explanation on a scene
                timeline, watch it play in the browser, and export it in the shape each platform
                wants — without opening After Effects.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <ButtonLink href="/signup" size="lg">
                  Start a project
                  <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg">
                  Sign in
                </ButtonLink>
              </div>

              <p className="mt-4 text-[13px] text-mist-dim">
                Free while MotioCode is in development. No card, no trial timer.
              </p>
            </div>

            <HeroComposition />
          </div>
        </section>

        {/* --------------------------------------------------------- studios */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                Three studios, one timeline.
              </h2>
              <p className="max-w-sm text-[15px] leading-relaxed text-mist">
                Code, diagrams and infographics share the same scenes, the same animation model and
                the same export. Mix them in a single project.
              </p>
            </div>

            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {STUDIOS.map((studio) => (
                <li
                  key={studio.name}
                  className="flex flex-col rounded-panel border border-line bg-panel p-5 transition-colors duration-200 hover:border-line-strong"
                >
                  <div className="flex items-center gap-2.5">
                    <studio.icon className="size-4 text-amber" aria-hidden="true" />
                    <h3 className="text-[15px] font-semibold tracking-tight">{studio.name}</h3>
                  </div>

                  <p className="mt-3 text-[14px] leading-relaxed text-paper/80">{studio.lede}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-mist-dim">{studio.detail}</p>

                  {/* A three-track strip: what this studio's scenes look like on the timeline. */}
                  <div className="mt-5 space-y-1" aria-hidden="true">
                    {studio.track.map((clip, index) => (
                      <div key={index} className="relative h-1.5 rounded-full bg-ink-sunk">
                        <div
                          className="absolute inset-y-0 rounded-full bg-line-strong"
                          style={{
                            left: `${clip.from * 100}%`,
                            width: `${(clip.to - clip.from) * 100}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ principles */}
        <section className="border-t border-line bg-panel/35">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Built like a renderer, not a slideshow.
            </h2>

            <dl className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {PRINCIPLES.map((principle) => (
                <div key={principle.title} className="border-t border-line pt-4">
                  <dt className="text-[15px] font-semibold tracking-tight text-paper">
                    {principle.title}
                  </dt>
                  <dd className="mt-2 text-[14px] leading-relaxed text-mist">{principle.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------------------------------------------------- formats */}
        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                One project, every aspect ratio.
              </h2>
              <p className="max-w-sm text-[15px] leading-relaxed text-mist">
                Pick the canvas when you start, change it whenever. Scenes reflow; timing does not
                move.
              </p>
            </div>

            <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {ASPECT_RATIOS.map((ratio) => {
                const preset = CANVAS_PRESETS[ratio];
                return (
                  <li
                    key={ratio}
                    className="flex flex-col items-start gap-4 rounded-panel border border-line bg-panel p-4"
                  >
                    <div
                      aria-hidden="true"
                      className="w-full max-w-[104px] rounded-sm border border-line-strong bg-ink-sunk"
                      style={{ aspectRatio: ratio.replace(":", " / ") }}
                    />
                    <div>
                      <p className="tabular text-[13px] text-paper">{ratio}</p>
                      <p className="mt-0.5 text-[12px] text-mist-dim">{preset.use}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------------- CTA */}
        <section className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-20">
            <div>
              <h2 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                Explain the thing you keep redrawing on a whiteboard.
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mist">
                Start from a blank canvas or a starter template, and keep the project editable
                forever.
              </p>
            </div>
            <ButtonLink href="/signup" size="lg" className="shrink-0">
              Start a project
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <div className="flex items-center gap-2 text-mist">
            <LogoMark className="size-5" />
            <span className="text-[13px]">Bring Your Code and Ideas to Life.</span>
          </div>
          <p className="tabular text-[12px] text-mist-dim">
            MotioCode · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
