# Remotion licensing

Read on 2026-09-26 from the Remotion licence itself and the official FAQ, before
building anything on it. §11 of the master prompt asks for this investigation
before commercial deployment; it is cheaper to do it before the dependency is
load-bearing than after.

Sources:

- `LICENSE.md` in the Remotion repository (`remotion-dev/remotion`, `main`)
- <https://www.remotion.dev/docs/license/faq>
- <https://www.remotion.dev/docs/licensing> (telemetry and the `licenseKey` option)

Package versions pinned at the time of reading: `remotion@4.0.529`,
`@remotion/player@4.0.529`.

## It is not MIT, and not "unlimited commercial use"

Remotion is source-available under a two-tier licence. The distinction is **the
size of the legal entity**, not whether the use is commercial.

**Free License — eligible if you are:**

- an individual, whether for personal or commercial use
- an organisation or team of up to 3 people
- a non-profit or not-for-profit organisation
- evaluating it, and not yet using it commercially

The FAQ is explicit that there is **no functional difference** between the tiers,
that you may make money under the Free License, and — directly relevant here —
that if you are eligible you need no licence "even if you set up an automation,
**launch a SaaS**, or are using it commercially". Incorporation does not matter;
a one-person company qualifies.

**Company License — required above that threshold:**

- **Remotion for Creators** — $25/month per person writing Remotion code, for
  producing videos without an automation.
- **Remotion for Automators** — **$0.01 per render, minimum $100/month**, for
  owning code that programmatically calls a render API. A combined minimum spend
  of $100/month applies if both are active.

An "automation" is defined as owning code that calls `renderMedia()`,
`renderStill()`, `renderFrames()`, `renderMediaOnLambda()`, and similar.

**Disallowed at every tier:** copying or modifying Remotion in order to sell,
rent, license, relicense or sublicense your own derivative *of Remotion*. Selling
videos made with it is fine; selling a competitor built from its code is not.

## What this means for MotioCode

Today, as a solo project, MotioCode sits squarely in the Free License, SaaS and
all. Nothing is owed and nothing needs signing.

The cost does not appear gradually — it appears the moment headcount passes 3,
and it appears as the Automators tier, because a product whose whole purpose is
rendering videos for its users is an automation by Remotion's definition. Budget
it as **$0.01 per render against a $100/month floor**, which is the price of
10,000 renders; below that volume the floor dominates. This belongs in pricing
before a paid plan is offered, since it is a direct per-unit cost of the export
feature.

Two consequences worth carrying forward:

1. **Per-render cost argues for cheap previews and deliberate exports.** Preview
   playback in the browser is free; a render is not. The export flow should make
   the settings clear *before* the render, which is why the preview modal states
   the output size, frame rate, length and frame count up front.
2. **Client-side rendering does not avoid the licence.** `@remotion/web-renderer`
   is monetised the same way, and unlike the other packages it **always** sends a
   telemetry event. Eligibility under the Free License is declared by passing
   `licenseKey: "free-license"`.

## Telemetry, if client-side rendering is adopted

`@remotion/web-renderer` always reports, and for client-side rendering the
**end user's IP address** is recorded by Remotion, alongside the licence key, the
host domain, the event type, and whether the render succeeded. No media content or
user data is sent, and telemetry never blocks or fails a render.

That is a third party receiving an identifier belonging to our users, so if
in-browser export ships it must be reflected in the privacy policy — Remotion's
own guidance is to disclose it as operational telemetry shared with a technical
service provider under Legitimate Interest. Retention is currently indefinite.
Opting out requires an Enterprise agreement ($500/month minimum).

## Revisit when

- Headcount reaches 4.
- A paid plan is designed, since per-render cost sets the floor on export pricing.
- Remotion 5.0 lands: telemetry via `licenseKey` becomes **mandatory** for
  render-based licensing, and the licence changes slightly.
- Before enabling in-browser export, for the privacy-policy obligation above.
