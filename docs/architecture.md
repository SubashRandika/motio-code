# MotioCode architecture

Written for: engineers working on this codebase.

The short version: **a project is data, a frame is a number, and everything drawn
on screen is a pure function of the two.** Keeping that true is what lets the
editor preview and a future headless renderer agree on every pixel.

## Layers

```
app/          Next.js routes only. Server Components fetch; Client Components interact.
features/     Feature modules. Each owns its actions, queries and UI.
core/         Framework-free. No React, no Next, no Supabase.
components/   Shared design-system primitives.
lib/          Supabase clients, env, small utilities.
supabase/     Migration history (also applied to the hosted project).
tests/        Vitest unit and component tests.
```

`core/` is the rule that keeps the rest honest. It has no imports from React,
Next.js or Supabase, so the project model and animation engine can be reused by
a Remotion composition or a render worker without dragging the UI along.

```
core/model/       Zod schemas + types: project, scene, element, animation, canvas, theme, export
core/animation/   easing, interpolate, resolve (element -> render state), timeline (scenes -> frame axis)
core/editing/     geometry (resize, snap, align, marquee) and history (bounded undo stack)
core/diagram/     connector routing, layered layout, the Mermaid-subset parser, compile
core/code/        syntax tokens, the cached highlighter, reveal arithmetic
core/presets/     the named animation presets, written in terms of the model above
core/infographic/ locale-free number formatting, chart scaling, value animation
core/templates/   the ten starter templates, as functions from a canvas to scenes
core/render/      the project-to-composition mapping, plus the render job lifecycle
```

## The timing model

Everything is measured in **frames**. The project's `canvas.fps` is the only
place frames become seconds.

- A **scene** has `durationInFrames`.
- An **element** has `from` (frames into its scene) and `durationInFrames`
  (`null` means "until the scene ends").
- An **animation** declares a `trigger` (`enter`, `exit`, `at`), an offset and a
  duration, and is resolved against the element's local frame axis.

`buildTimeline(scenes)` lays scenes onto one project-wide frame axis. A scene
with an incoming transition *starts before the previous one ends*, so the two
overlap; the overlap is capped so a transition can never consume a whole scene.
During an overlap `getActiveSegments()` returns both scenes.

`resolveElementState(element, sceneFrame, sceneDuration)` turns an element into
a concrete render state. When several animations overlap:

| Property | Rule |
|---|---|
| `opacity` | multiplies |
| `translateX` / `translateY` | accumulates |
| `scale` | multiplies |
| `highlight` | strongest active highlight wins |
| `revealProgress` | most restrictive (smallest) wins |

Outside an animation's window the element holds that animation's start value
(before) or end value (after), so state is defined at **every** frame. Exit
animations run the same curve in reverse, which is why one preset works as both
an entrance and an exit.

### Why not CSS animations

A CSS animation cannot be seeked to an arbitrary frame and cannot be rendered
headlessly. `useFrameClock` derives the frame from elapsed wall-clock time and
hands that single number down; components read only from the resolved state.

## Data model and persistence

Scenes are **rows**, elements are **JSON inside a row**.

Scenes are the unit of reorder, duration and selection, so they earn columns the
database can index and constrain. Elements are polymorphic and always loaded
with their scene, so a relational element table would buy joins and schema churn
for nothing. `scene_data` is validated with Zod on write *and* on read — stored
JSON is treated as untrusted and a corrupt blob falls back to defaults rather
than breaking the editor.

`projects.data_version` and `project_scenes.data_version` exist so a future
shape change can be migrated instead of guessed at.

### Tables

| Table | Notes |
|---|---|
| `profiles` | Created by a trigger on `auth.users` |
| `projects` | `canvas_config`, `theme_config`, `export_config` as validated JSONB |
| `project_scenes` | `scene_order` unique per project, **deferrable**, so a reorder lands in one transaction |
| `assets` | Storage pointers, never file bytes |
| `render_jobs` | Client creates and reads; only the render service advances `status` |

### Row Level Security

Every table is owner-scoped with `TO authenticated` **plus** an ownership
predicate, and every UPDATE policy carries both `USING` and `WITH CHECK` so a
row cannot be reassigned to another user.

`project_scenes.owner_id` is **denormalised** from its project so no policy ever
needs a join. It is set by a `BEFORE INSERT` trigger that runs as the *caller*
(`SECURITY INVOKER`): a user who cannot see the project under RLS gets
"project not found" instead of a scene. The client's `owner_id` is ignored.

Verified behaviours:

- A user sees 0 of another user's projects, scenes and profiles.
- Inserting a scene into someone else's project is refused by the trigger.
- Reassigning `owner_id` on your own project is refused by `WITH CHECK`.

Storage buckets are all private, keyed `{owner_id}/{project_id}/{filename}`, with
policies matching the first path segment against `auth.uid()`.

## Auth

`@supabase/ssr` with three clients: browser, request-scoped server, and the
Next.js **proxy** (`proxy.ts` — Next 16's rename of middleware). The proxy
refreshes the session on every request and gates routes.

Server code always uses `getClaims()`, never `getSession()`: `getClaims()`
verifies the JWT signature against the project's published keys.

`/auth/confirm` handles both emailed link styles — a `token_hash` (custom email
template) and a PKCE `code` (stock template) — so the flow works whichever the
project is configured with.

## Editor state

One Zustand store per open project, created through `EditorStoreProvider`.
The store holds the working copy, selection and save status.

**Playback is deliberately not in the store.** The frame changes up to 60 times
a second; routing it through a shared store would re-render every subscriber.
`useFrameClock` lives in the shell and passes `frame` only to the canvas and the
timeline.

Every project change goes through one `edit()` helper in the store, which runs
the recipe, records the previous project for undo, and marks the project dirty.
Nothing mutates the project outside that path.

Selector discipline: a selector that builds a new array (`selectSelectedElements`)
must be wrapped in `useShallow`. Zustand compares with `Object.is`, so returning
a fresh array from a bare selector re-renders forever.

Saving is a debounced autosave plus a manual save (toolbar and Ctrl/Cmd+S). The
payload is built from the store *at save time*, so a keystroke landing
mid-debounce is never lost. The server re-validates the whole payload with Zod
before it reaches the database.

### Undo

`core/editing/history.ts` is a bounded stack of whole project snapshots, capped
at 80 steps. Snapshots rather than inverse commands: the project is plain data
updated immutably, so untouched scenes are shared between snapshots and a step
costs little more than what actually changed. It is also impossible to get
wrong, which matters more than the bytes.

Steps are grouped by a `coalesceKey`:

- A run of typing shares a key and collapses inside a 700ms window, so a name
  edit is one undo, not one per character.
- A drag passes a key unique to that gesture plus `coalesceWindowMs: Infinity`,
  so the whole gesture is one step however long it lasts.

Undo restores the project only. Selection is repaired afterwards by dropping
any scene or element that the restored project no longer contains.

## Canvas editing

All pointer maths happens in **canvas units**, never screen pixels, so a drag
means the same thing at any zoom and produces coordinates identical to what a
render at another resolution uses.

Selection chrome (outlines, the eight resize handles, snap guides, the marquee)
is drawn in an overlay *outside* the scaled layer, in display pixels. That is
what keeps handles the same physical size as you zoom.

Snapping offers the canvas edges and centre plus every other element's edges and
centre. Only the closest line within the threshold wins per axis, so an element
never jitters between two competing guides. Alt disables it.

Layer numbers are normalised to 0..n-1 after every change. Two helpers, and the
difference matters: `assignLayers` numbers by array order (used after a
reorder), `relayer` sorts by existing layer first (used after an add or delete).
Sorting after a reorder would undo the reorder.

## Configuration panel

An optional JSON view of the active scene, validated against the same
`sceneDataSchema` the server uses. Edits are never applied as you type: a failed
validation leaves the text exactly as written and lists the failing paths, so
nothing typed is lost. Changes made on the canvas flow back into the draft only
while the draft is clean.

## Diagrams

### Why there is no React Flow

AGENTS.md names React Flow "where appropriate". It is not appropriate here, for
three reasons:

1. **It cannot render inside a composition.** React Flow owns a viewport
   transform and measures nodes through `ResizeObserver`. Neither is
   frame-deterministic, so a headless render could not reproduce it. Using it for
   editing and something else for export would mean two implementations of the
   same picture, which is exactly the drift the frame model exists to prevent.
2. **Two viewport models would fight.** The stage is a fixed design-resolution
   surface scaled to fit. React Flow wants to own pan and zoom itself.
3. **The work was already done.** `use-canvas-interaction` already does
   hit-testing, multi-select, drag, resize, snap and marquee in canvas units.
   Node editing is that same problem.

So nodes and connectors are **ordinary scene elements**. They inherit selection,
dragging, snapping, alignment, per-element timeline tracks, animations, undo and
the properties panel for free, and they render in the same tree a Remotion
composition will.

### Nodes and connectors

A `node` carries a label, shape, icon and accent. Its outline is inline SVG
rather than CSS borders, because a diamond, hexagon or cylinder cannot be drawn
with `border-radius` and a clip-path would throw the border away.

A `connector` names two node ids. **Its geometry is derived, never authored** —
`buildConnectorPath` routes it from the two boxes on every render, so a node can
be dragged anywhere and nothing stored can go stale. Consequences:

- Connectors are selectable but never draggable; their box is computed for the
  selection outline rather than read from `rect`.
- All connectors in a scene share one SVG, inserted at the lowest layer any
  connector holds, so routes sit behind the boxes they join.
- A connector cannot outlive its nodes: deletion prunes, duplication only copies
  a route when both its nodes came along, and loading prunes again as defence
  against a hand-edited scene.

Routing produces an SVG path *and* a flattened polyline. The polyline is what
lets a flow marker sit at a given progress with pure arithmetic instead of
`getPointAtLength`, which would not work headlessly. A draw-on reveal uses
`pathLength="1"` so the dash maths needs no measurement at all.

### Connecting

Four connect nubs appear *outside* a selected node's box, so they never compete
with a resize handle for the same pixel. Dragging one and dropping on another
node creates the connector. Hit-testing during that drag uses the stored rects,
not the DOM, because the overlay sits above the stage. Selecting several nodes
and pressing "Connect in order" is the keyboard path.

### Text definitions

MotioCode parses a **Mermaid subset itself** rather than depending on Mermaid.
It needs the graph, not a picture of it: the nodes and edges become scene
elements the animation engine already understands. Mermaid renders its own SVG
through the DOM, which could not be animated per node or rendered to video.
Borrowing the syntax gives users a format they know at no bundle cost.

The authoritative rule, stated in the panel itself:

> **Text owns the structure. The canvas owns the positions.**

Applying text adds, removes and relabels nodes and routes, matching existing
ones by the `sourceKey` each node remembers. It places a node only the first time
that node appears, so a layout arranged by hand survives later edits. Positions
are never written back into the text, which is why applying is an explicit
action rather than something that happens as you type. Duplicating a node clears
its `sourceKey`, because the copy is no longer the one the text defined.

Layout is a deterministic layered ranking — longest path from a root, relaxed so
a cycle degrades instead of failing. It is the minimum needed to draw a graph
that was written rather than arranged; crossing minimisation and the rest belong
to a later phase. Node sizes are measured arithmetically, never from the DOM, so
layout is identical in a test, on a server and in a browser.

Errors are reported per line and block applying; syntax MotioCode does not model
(`subgraph`, `classDef`, …) warns and is skipped rather than failing the whole
definition.

## Code panels

### Highlighting never touches the frame path

Tokenising is expensive and has nothing to do with the frame being drawn, so it
happens once per unique `(code, language, theme)` and is cached. A panel whose
source has not changed re-renders at the frame rate without going near a
highlighter, and everything time-dependent — which lines are in, where the caret
sits, which lines are dimmed — is arithmetic on the render state.

The first time a source appears the panel draws *uncoloured* lines and loads the
highlighter in the background; one re-render swaps the tokens in. Highlighting
deliberately never blocks a paint. A dropped frame while scrubbing would be worse
than a few frames of plain text, and the preview has to keep the timing the
renderer will.

Three choices inside `core/code/highlight.ts`:

1. **Shiki's fine-grained bundle, not the full one.** Only the eight languages
   the product supports and the two themes it ships are loaded, through a dynamic
   import. The editor route's initial JavaScript contains no Shiki at all.
2. **The JavaScript regex engine, not the WebAssembly one.** No `.wasm` asset
   means the same code path works in the browser, in the test runner and in a
   headless renderer with no bundler configuration.
3. **A bounded cache keyed on the input.** Tokenising is a pure function, so one
   result serves every frame of the animation and every re-render.

Shiki drops the trailing empty line that `split("\n")` keeps. It is restored,
because line numbers and the reveal maths are derived from the source and a panel
that renders one row short of its own line count looks broken.

### Revealing code

`revealCode` turns a 0-1 progress into per-line tokens. Which unit it counts is a
property of the *panel*, not of the animation, because the engine's rule is that
the element decides what a "part" is:

- `line` fades each line in whole — the line-by-line reveal. Lines that have not
  arrived keep their tokens at opacity 0, so the panel never reflows.
- `character` types the code out, truncating one line mid-flight — the
  typewriter. A newline counts as a character so a blank line still takes time,
  which is what stops a gap in the source being skipped instantly.

The caret's blink is derived from the frame number rather than a CSS animation,
so a seek lands on the same caret state every time.

### Focus, and why the newest one wins

`focus` names a range of parts and a dim level; parts outside the range fade
towards it. It is the primitive behind highlight-and-explain and the walkthrough.

Several focus animations on one element compose by a rule worth stating: **the
one whose window started most recently is in force.** Declaration order is
deliberately not what decides it. Every animation holds its end value after its
window, so every earlier step of a walkthrough sits at progress 1 forever and
"last declared wins" would freeze on the final step.

## Presets

A preset is a starting point, not an effect. Each one writes plain animations and
content settings the user can then open in the properties panel and change.
Nothing in `core/presets` is a new engine capability — if a preset needed one, the
model is what should have grown. `focus` is exactly that: three of the six wanted
it, so it became an animation type rather than six special cases.

Applying a preset **replaces** the element's animations, in one undo step. A
preset means "make this read like a typewriter", and layering that onto whatever
was already there would produce something nobody asked for. The panel says so
before the user clicks.

The animations themselves are built by the constructors in
`core/animation/build.ts`, which the templates use as well. `createAnimation(type)`
in the model gives a *default* animation for the properties panel to edit; these
take the values the caller actually wants. One home for them means a preset and a
template cannot disagree about what a fade is.

Two of the six are scene-scoped. A before-and-after comparison and a sequential
transformation are not one element animating; they are two panels arranged in
space or in time. Modelling them as element presets would have meant an element
preset that silently created elements, so the scope is part of a preset's type and
the store takes a different path for each. Both label their panels through the
existing window bar rather than adding text elements to be kept in sync.

## Infographics

Five element kinds: `counter`, `progress`, `chart`, `comparison`, `steps`. They
join the element union and nothing else in the engine changes, which is the test
of whether the union was the right extension point.

`steps` covers two of AGENTS.md's bullets. Laid out downwards it is a process;
laid out across with its joining line on it is a timeline. They are the same data
in two orientations, so there is one element rather than two that would drift
apart.

### The data is the source of truth

AGENTS.md requires that "animated values and chart representations remain
faithful to the underlying data". That rules out the obvious design, an animation
carrying its own `from` and `to`: the moment a user edits the counter's value, the
animation would still be counting to the old one, and the slide would show a
figure that is not in the project.

So the `count` animation carries **no target at all** — only progress. The element
multiplies its own stored numbers by that progress. The last frame therefore shows
exactly what is stored, by construction rather than by being kept in step. A
bar's length and the figure printed beside it are derived from the same number, so
they cannot disagree.

### Two axes, not one knob

- **`count` animates magnitude.** `valueProgress` scales every number in the
  element towards its stored value, all together.
- **`reveal` animates presence.** Parts arrive in sequence, and the part in flight
  is drawn part-way rather than popped in, so a bar grows as it appears.

A part's factor is the product of the two, so they compose with no special case:
with neither animation every factor is 1 and the element simply shows its data.
`partFactors` is built on the same `resolveReveal` the code panel used, so
"which parts are in" has one implementation across the whole product.

### Number formatting is locale-free

`formatNumber` groups thousands itself rather than calling `toLocaleString`. The
browser, the test runner and a headless renderer can disagree about the current
locale, and a figure that reads "1,200" in the editor and "1 200" in the export
would be a rendering bug nobody could reproduce. Decimals are fixed-width for the
same reason a counter uses tabular figures: so the number does not change width
while it counts.

Non-finite input formats as zero. A chart is a thing people put on a slide, and
"NaN" on a slide is worse than a wrong-looking zero.

### What is deliberately missing

No axes, gridlines, legends, stacked or grouped series, pie charts or
trend lines. AGENTS.md asks for "basic bar charts" and warns against building a
charting platform; a labelled bar is what a technical slide actually needs. The
element's schema is the place to grow when that stops being true.

## Templates

### Code, not stored data

A template is a function from a canvas to scenes. It runs once, when a project is
created, and after that the user owns ordinary scenes that know nothing about
where they came from.

The alternative -- a table of template JSON -- would have to be migrated every
time the element schema grew, and could hold an element shape the current code
can no longer render. For a fixed set of starting points that is cost with no
benefit. The trade-off flips the moment users can save their own templates, which
is a later phase; `projects.template_id` already records which one a project
started from, so nothing has to change to find out.

The id is the stable part. It is stored on the project, so renaming a template is
free but changing its id is not.

### Two rules the builders enforce

1. **A template never writes an element literal.** Everything goes through
   `createElement` and is then patched, so a template cannot produce an element
   the schema would reject, and a newly required field gets a value for free.
2. **A template never writes a pixel.** Positions are fractions of the canvas, and
   durations are seconds converted at the project's frame rate. A template with
   hard-coded pixels would be unusable on three of the four aspect ratios the
   product offers, and one with hard-coded frame counts would run at the wrong
   speed at 60fps.

`tests/core/templates.test.ts` builds every template on every aspect ratio and
checks that nothing lands off the canvas, that every animation finishes inside its
scene, and that ids are fresh on each build.

### Diagrams come from their own text

A diagram template supplies only a Mermaid-subset definition. Layout and routing
come from the same code path the diagram panel uses, and the definition is stored
on the scene, so the user can open the text panel and keep editing it. A template
whose definition does not parse throws rather than degrading -- that is a bug in
the template, and a silent empty scene would hide it.

Boxes are staggered by an increasing fade offset rather than by a reveal, so every
element stays present for the whole scene. A route is drawn only once both of the
boxes it joins have arrived, and its flow marker only once the route itself is
drawn, so an arrow never appears before the thing it points at.

### A layout that fits

Adding the templates exposed a real defect in `layeredLayout`: it centred a graph
without checking that the graph fitted. A six-node `flowchart LR` needs roughly
twice the width of a 1080-wide portrait canvas, so half of it sat at negative
coordinates -- off the stage, and awkward to drag back.

It now scales the layout uniformly to fit inside a 4% margin, and `compileDiagram`
scales the node label size by the same factor so text stays in proportion to its
box. A graph that already fits is never enlarged. This was not a template problem:
any user writing a wide flowchart on a portrait canvas hit it.

## Preview and rendering

### One composition, two clocks

`features/preview/composition.tsx` holds `ProjectComposition`: everything a
project looks like at a given frame. It takes a project and a frame and nothing
else -- no store, no selection, no zoom, no refs, no measurement -- so the same
two arguments always produce the same pixels.

Both the editor canvas and the Remotion render draw *that* tree. The editor wraps
it in a scaling container and its selection chrome; `MotioComposition` wraps it
in the export's scale and offset and feeds it `useCurrentFrame()`. There is no
second implementation of the composition to keep in step, which is the reason the
preview and the output cannot drift apart.

What does differ is the clock. `useFrameClock` drives the editor canvas, because
the canvas has to stay editable while it plays and the playhead is shared with
the timeline; the Remotion Player drives the preview modal. Two clocks is a real
risk, and it is bounded deliberately: a clock's only output is an integer frame,
and everything downstream is a pure function of it. A disagreement can therefore
only ever be about *which* frame is shown, never about what a frame contains.

### The mapping is pure

`core/render/plan.ts` is framework-free, so the decisions a render depends on are
testable without mounting anything:

- **The canvas is never cropped.** When the export aspect ratio differs from the
  one the project was composed at, the canvas is scaled to fit and centred,
  leaving bars in the canvas colour. Cropping would silently cut away work the
  user arranged deliberately. Matching the export ratio to the canvas produces no
  bars at all, which is why the properties panel marks that option `(canvas)`.
- **Changing the export frame rate resamples, it does not retime.** The timeline
  is authored in canvas frames, so 60fps output must be the same number of
  *seconds* at twice the frames -- not a video that plays at half speed.
  `canvasFrameFor` converts an output frame back to the authored frame it should
  draw. This is only arithmetic because every element is already a pure function
  of a frame number.
- **A composition is never shorter than one frame.** Remotion rejects a zero
  length, and a project with no scenes yet is a normal thing to preview.

### The Player is loaded on demand

`@remotion/player` is a few hundred kilobytes and most editing sessions never
open the preview, so `ExportPreview` is a `next/dynamic` import with `ssr: false`.
Remotion is absent from every eager chunk of the editor route; it arrives when
the Preview button is pressed.

Draft preview quality renders the same composition at 720p. It changes nothing
about the export -- only how many pixels the preview asks the browser for per
frame, so a heavy project plays at its true speed instead of stuttering.

### Exporting happens in the tab

There is no render server. `@remotion/web-renderer` encodes through WebCodecs in
the browser, which is what makes an export prototype possible at all without
infrastructure -- and it decides the shape of the flow:

- **A render can be refused before it starts.** `canRenderMediaOnWeb` reports
  whether this browser can encode the requested container and codec at these
  dimensions. An unsupported browser gets a sentence, not a failure several
  minutes in, and **no job row**: a render that could never have run has no place
  in export history.
- **A render must be cancellable.** It runs on the user's own machine, so an
  `AbortSignal` is wired through and a cancellation is recorded as an outcome
  rather than as an error.
- **GIF is refused, not substituted.** WebCodecs has no GIF container, so
  `webRenderTarget` returns `null` for it and the UI says so. The format stays in
  the project model -- projects may have it saved, and a server-side renderer can
  produce one later -- but handing back an mp4 named `.gif` is not an option.
- **Progress stays local.** The job row records that a render happened and how it
  ended. Writing progress frame by frame would be a request per frame for a
  number only that tab is looking at.

The renderer is imported inside the render call, so `remotion`,
`@remotion/web-renderer` and `mediabunny` are absent from every eager chunk of the
editor route.

### Download, not storage

A browser render produces the file on the user's machine already, so it is handed
straight to them and nothing is uploaded. `render_jobs` records what was exported,
at which settings, and whether it worked; `output_path` stays null.

The cost of that choice is that re-downloading means re-rendering. The cost of the
alternative is storage and egress on every export, plus an upload the user waits
through, for a file they already have. Export history answers "what have I
exported and did it work", which is what §14 asks of it. When server-side
rendering lands, that is the point at which `output_path` starts being written --
by `service_role`, never by a client.

### A job's status is written by its renderer

The `motiocode_core_schema` migration gave clients no UPDATE on `render_jobs`, on
the assumption that a
server-side service holding `service_role` would advance them. With the renderer
in the browser, the owner's own session is the renderer and has to report the
outcome, so `render_jobs_owner_can_advance` adds an owner-scoped UPDATE policy.

The grant is **column-scoped**, because RLS cannot restrict columns and these
columns are not equal. `status`, `progress`, `error_message`, `started_at` and
`completed_at` are render telemetry and belong to the renderer. `project_id` and
`owner_id` decide whose row it is; `render_settings` is the record of what was
asked for, so a rewritable one would make history a lie; and `output_path` names
an object in storage, so a client-writable path is a way to aim a download at
someone else's file. Those four stay unwritable by any client.

Transitions are checked in `core/render/job.ts` against the row's current status
rather than written blind, because a tab can vanish mid-render, a retry can report
twice, and a cancellation can land after a success. A job that has ended stays as
it ended.

### Licensing, before it becomes expensive

Remotion is not MIT. It is free for individuals and organisations of up to three
people, explicitly including commercial use, SaaS and automations; above that it
is $0.01 per render with a $100/month minimum. The threshold is headcount, not
revenue, and the render-based tier is exactly what a product that renders videos
for its users falls into. `docs/decisions/remotion-licensing.md` records the
terms as they were read, with dates.

## Testing

Two suites, split by what they can actually see.

```
tests/   Vitest. Pure logic and components, in jsdom. Fast, run constantly.
e2e/     Playwright. Real browser, real server, real requests.
```

`vitest.config.mts` includes only `tests/**/*.test.{ts,tsx}`, so the Playwright
specs in `e2e/` are never swept up by the unit runner.

### What only a browser can answer

Three things are structurally invisible to the unit suite, and each has already
hidden a real defect:

1. **Route protection lives in the proxy (middleware).** It runs only for a real
   request, so no component test can reach it. `e2e/auth-gate.spec.ts` checks
   every protected route redirects a signed-out visitor to `/login?next=…`, and
   that the public ones stay public.
2. **jsdom has no layout engine**, so every element measures 0x0 and nothing can
   overflow. `e2e/responsive.spec.ts` found the landing page scrolling sideways
   by 72px on a Pixel 5: below `lg` the hero's single-column grid track sized to
   the code block's max-content, and `overflow-x-auto` cannot shrink a
   content-sized grid track. `grid-cols-1` -- Tailwind's `minmax(0,1fr)` -- is
   the fix.
3. **A redirect is settled by the browser, not by the function that returned it.**
   See below.

### Playwright runs against a build, on its own port

The `webServer` runs `next build && next start --port 3100`, not `next dev`.
A production build is what ships, dev mode's on-demand compilation makes a first
navigation look like a timeout, and a dedicated port stops a run silently reusing
a dev server the author already had open on 3000 -- which would test whatever code
*that* server was running.

The suite runs at two viewports: `Desktop Chrome` and `Pixel 5`. The editor is
excluded from the mobile project because it is desktop-first by design.

### The authenticated half

The §20 journey -- sign in, create, edit, preview, save, reopen, export -- needs a
session, and the two ways of getting one are not equivalent:

- A **local Supabase stack** (`supabase start`) is the safe one: a throwaway
  database, no risk to real work, and it would fix the divergent migration history
  as a side effect. It needs Docker, which is not installed on this machine.
- A **dedicated test account on the hosted project** is the available one, and it
  means a browser creating and deleting real rows in the same database that holds
  real work.

The harness takes the second route, with containment designed in rather than
bolted on:

```
e2e/auth.setup.ts          signs in once, saves the session for reuse
e2e/authenticated/         the specs that need it
playwright/.auth/user.json the saved session (gitignored, never committed)
```

`E2E_EMAIL` and `E2E_PASSWORD` come from the environment. Without them the setup
writes a signed-out state and the authenticated specs **skip** rather than fail --
a missing test account is not a broken product.

Three rules keep it off real data:

1. Every project it creates is named with a unique run id (`e2e-<base36 time>`),
   so no locator can match something a human made.
2. It only acts on a project it created, found by that exact name.
3. It deletes its own project at the end, through the UI -- which also exercises
   the delete confirmation.

The journey stops short of running a render. A full export is slow, and every
render is a metered event under Remotion's licence, so the spec asserts the export
is offered and enabled rather than paying for one per CI run.

Note that the projects are split by session rather than by file. Handing every
project a saved session would make the route-protection specs assert the opposite
of what they mean, so `desktop` and `mobile` deliberately ignore
`e2e/authenticated/`.

## Schema evolution

Stored scenes outlive the code that wrote them. Two rules:

- A new field on an existing schema must carry a default, so an older row still
  parses. `tests/core/backward-compatibility.test.ts` pins a real pre-diagram
  scene verbatim and fails if that stops being true.
- A new element kind is additive to the `sceneElementSchema` union, and nothing
  else in the engine changes. So is a new animation kind: `tests/core/persistence.test.ts`
  iterates `ANIMATION_TYPES` rather than a hand-written list, so one cannot be
  added without being covered.

### Migrations are named the way the CLI names them

`<utc-timestamp>_<name>.sql`, which is what `supabase migration new` produces.

They were once numbered `0001`–`0005`, which read more nicely and was wrong in a
way that only shows up under the CLI. The remote history table records the
version taken from the filename prefix, and the first three had been applied
through the dashboard under their timestamps. So local and remote shared no
versions at all: `supabase migration list` showed five local migrations with no
remote counterpart and three remote with no local one, and `supabase db push`
would have tried to re-run the schema from scratch against a live database.

Renaming to the timestamps the remote history already held made four of them
line up; `supabase migration repair --status applied` recorded the two that had
been run by hand. `db push` now reports `up to date`, which is the only useful
state for it to be in.

Two consequences worth keeping in mind:

- **Refer to a migration by its name, not its number.** The prose above says
  `motiocode_storage_buckets` rather than `0002` for exactly this reason.
- **Applying SQL outside a migration leaves the history wrong.** Running DDL
  through `execute_sql` or the dashboard changes the database without recording
  anything, and the gap is invisible until a push goes wrong. Either use the
  migration path, or repair afterwards.

A connector is excluded from `createElement`'s input type rather than left as a
branch that could only produce an invalid element — it is drawn between two
existing nodes, never added from the rail.

Two exhaustive maps and one `never` assignment do the enforcing. `ELEMENT_LABELS`
and `ELEMENT_ICONS` are `Record<ElementType, …>`, and `ElementContent` ends by
assigning the narrowed element to `never`. A new element kind therefore fails to
compile in three places until it has a label, an icon and something to draw,
instead of quietly rendering nothing.

### Redirect targets are judged after resolution, not before

`safeRedirectPath` decides where a user lands after signing in, and its input
arrives in a link anyone can email. A leading-slash check is not enough, because
a browser rewrites a path before following it:

| input | becomes | why |
| --- | --- | --- |
| `/\evil.com` | `//evil.com` | a backslash normalises to a forward slash |
| `/..//evil.com` | `//evil.com` | traversal collapses after parsing |
| `/<tab>/evil.com` | `//evil.com` | control characters are stripped |

All three passed the original check, and `//evil.com` is protocol-relative -- it
inherits the scheme and goes off-site. That is a phishing primitive: the victim
starts on the real domain and finishes somewhere else, already trusting the page.

Rather than enumerate tricks, the candidate is now resolved against a reserved
`.invalid` origin and the *result* is judged: the origin must not have moved, and
the resolved path must still start with a single slash. Both halves are needed --
traversal keeps the origin while producing a protocol-relative path.

## Design system

Dark-first, two accents used in strictly separate roles so colour carries
meaning:

- **amber** — the user and their actions (brand, buttons, selection)
- **cyan** — time and the machine (playhead, timecodes, render status)

Tokens live in `app/globals.css` under `@theme`. Frame counts and timecodes use
the `.tabular` class so digits never shift as the playhead moves.

Composition themes (`core/model/theme.ts`) are separate from the application's
own chrome, so a user can build a light-themed video inside a dark editor.

## Accessibility

The starting point was better than a typical first pass — a skip link, one focus
treatment, reduced motion honoured in the clock — and that made the remaining
problems the interesting kind: things that looked finished and were not.

### Contrast is asserted from the stylesheet, not from a screenshot

`--color-mist-dim` was `#5d6a7b`, which is **2.80:1** on `raised` and fails AA on
every surface in the app. It was not decorative: frame counts, scene durations,
element counts, placeholders and the export's own progress line all used it, at
10.5–12px. It now reads 4.67:1 at worst, and `--color-mist` moved up with it so
the ramp still has three distinguishable steps rather than two near-identical
greys.

`tests/core/contrast.test.ts` parses the tokens out of `globals.css` and checks
every one against every surface it is painted on. Parsing rather than duplicating
matters: a copied palette in a test passes forever while the real one regresses.
The test also asserts the *ramp* holds, because making `mist-dim` legible is
worthless if it ends up indistinguishable from `mist`.

A separate finding produced `--color-edge`. A text field is `bg-ink-sunk` on
`bg-panel`, and those differ by **1.12:1** — so the fill does not identify the
control and the border has to, which WCAG 1.4.11 puts at 3:1. `--color-line`
managed 1.37:1. Dividers and panel edges still use `line`, because they are
decorative and raising every border to 3:1 would make the whole interface shout.

### One focus treatment, actually applied

`globals.css` says "one focus treatment everywhere, always visible on keyboard",
and six places quietly overrode it with `focus:outline-none` — including both
full-panel code textareas, which suppressed it unconditionally. Tailwind's
utilities layer beats the base layer, so every text input in the app had **no
focus ring at all**; the only cue was a border colour change.

This is the clearest argument for testing accessibility in a browser. Nothing in
a type check, a component test or a screenshot notices a missing outline, and the
author — using a mouse — never sees the consequence.

### Global shortcuts must not eat a control's own keys

The editor binds shortcuts to `window`, which is the only way a canvas shortcut
can work when nothing in particular is focused. The cost is that the handler also
hears keys meant for whatever *is* focused, and `preventDefault()` there does not
duplicate the control's behaviour — it cancels it.

"Space toggles playback" therefore made **every icon button in the editor toolbar
unpressable by keyboard**, while working perfectly with a mouse. `lib/a11y/
key-ownership.ts` asks whether the focused element already means something by
this key, and the shortcut yields if so. It is deliberately generous: a shortcut
that fails to fire is a small annoyance, whereas one that eats a control's key
makes the control unusable without a pointer.

Escape now also yields to an open dialog, so closing the preview no longer throws
away the canvas selection on the way out.

### A role is a promise

`role="menu"` tells a screen reader the arrow keys will work. The project menu's
did not — no arrow navigation, no focus on open, and focus dropped to `<body>` on
close, landing a keyboard user at the top of the dashboard with no idea which
project they had been on. Announcing a widget and then not implementing it is
worse than using plain buttons.

The timeline had the same shape of problem from the other direction.
`role="slider"` is a leaf role, and the track carried the scene buttons inside
it, so a screen reader announced a slider and then found buttons in it. The role
moved to the playhead — where a native range input keeps it, on the thumb rather
than the groove — and a test now asserts the slider has no focusable children
*and* that the scene buttons are still reachable, so the rule cannot be satisfied
by making something inert.

### The canvas is pointer-only, and that is the honest answer

Dragging a box is not a gesture a keyboard has, and pretending otherwise would
produce a worse editor than admitting it. What matters is that nothing is *only*
reachable by pointer: selection is in the Layers list, position and size are
number fields in the properties panel, timing is on the clip and in those fields.
The canvas is a named region that announces what is selected, because the
selection outline is drawn in pixels and says nothing otherwise.

### Announcements are for events, not states

⌘S was silent. It now announces the settled result only — not "Saving", which is
immediately superseded by its own outcome, and not "Unsaved changes", which is an
ambient state that would interrupt on every keystroke. A failure keeps its
assertive `role="alert"`, because losing work is worth interrupting for. A render
announces its start and its end, never its percentage.

### axe and hand-written specs answer different questions

`e2e/accessibility.spec.ts` runs both. The axe sweep is good at breadth and knows
nothing about intent; the written specs check what is specific to this product —
whether the skip link goes anywhere, whether sign-in can be completed without a
pointer, whether a focused control is visibly focused.

Both were worth having. axe found a link distinguished only by colour and a code
panel that scrolls but could not be scrolled by keyboard. The hand-written focus
test found the suppressed outlines. And the reduced-motion spec found a genuine
product bug: because an autoplaying clock is held on its last frame for a viewer
who asked for less motion, `playing` was still true while the screen showed a
paused composition — so the button labelled **Play did nothing**. The clock now
toggles the state the viewer can see rather than the raw flag, and
`tests/components/frame-clock.test.tsx` covers it, which nothing did before.

The landing page hero is excluded from the contrast rule alone, and only there.
It is a mock video that fades its panel in at the start of every loop, so axe
samples whatever opacity it catches — true of any frame of any video mid-fade,
and not what 1.4.3 is about. The exclusion is kept earned: one test asserts the
`<figcaption>` text alternative exists, another scans the hero for every *other*
rule, and the tokens inside it are still measured statically.

### What this does not claim

Passing every rule here is not the same as being pleasant to use with a screen
reader, and no score should be read that way. The editor's authenticated surfaces
are not in the axe sweep yet, because the sweep runs signed-out; extending it is
a matter of pointing it at the authenticated project once a test account exists.

## Avatars

The header shows, in order of preference: a picture the user uploaded, then
their Gravatar if they allow it, then their initial.

### The order is the design

An upload beats Gravatar because one is a choice and the other is an inference
from an email address. Turning Gravatar off does not cost someone the picture
they deliberately uploaded — the two settings are independent, and the tests say
so, because collapsing them is the obvious refactor a year from now.

### Gravatar is an inference, so it is declinable

`profiles.use_gravatar` defaults to true, which keeps existing behaviour, but it
exists so that behaviour is a choice. When it is off **no request is made at
all** — not a request whose result is hidden, which would still carry the user's
hash to a third party.

Two things keep the default defensible. The address is never sent: Gravatar keys
on a SHA-256 of it. And the lookup is proxied through our own origin by
`next/image`, so Automattic sees our server rather than every signed-in user's IP
address on every page view. The setting's description in the profile form says
both of those in plain language, because someone deciding whether to allow it
needs to know who is being asked and what is being sent.

### The avatars bucket is public, and it is the only one

Every other bucket in `motiocode_storage_buckets` is private. This one is not, for a reason worth
writing down: a private object is read through a signed URL, a signed URL is
different every time it is generated, and `next/image` caches on the URL. A
fresh signature per render means a cache key per render — the optimizer would
re-fetch and re-encode the same picture forever, plus a Storage round-trip on
every authenticated page load.

What is traded away is small. An avatar at an unguessable path is readable by
anyone holding the URL, which is the same exposure every other product's profile
picture has, and it is not the class of data that projects and renders are.

**SVG is excluded from the allowed types.** An SVG is a document that can carry
script, and a public bucket serving user-supplied SVG is a stored XSS primitive.
PNG, JPEG and WebP cannot execute.

### The path crosses a trust boundary; the URL never does

The browser uploads straight to Storage rather than through a server action,
because a server action's body is capped at 1MB and an avatar may be 2MB —
routing it through the server would mean raising that cap for every action in
the app in order to carry image bytes twice.

The consequence is that the path arrives from the client. Two rules make that
safe, and both are tested:

1. **The path must be inside the caller's own folder.** RLS on
   `storage.objects` already prevents *writing* elsewhere; what is left to stop
   is a user *claiming* an object someone else wrote. The check is a full shape
   match rather than a `startsWith`, because `{uid}-evil/x.png` starts with the
   id and is a different folder.
2. **The URL is built server-side from the path, never accepted.** Accepting a
   URL would let anyone point their avatar at any address on the internet, which
   turns the header into a way to make every viewer's browser call a chosen
   server.

The limits in the upload form are a courtesy, not a control. Storage enforces
the size and the type list itself; the browser checks exist so the user gets a
sentence instead of an opaque rejection after a slow upload.

### Verified against the real policies

The RLS was proved by acting as an authenticated user inside a transaction that
rolled back: writing into your own folder is allowed, writing into another
user's folder is blocked, writing to the bucket root is blocked, and deleting
another user's avatar touches nothing.

### What is deliberately missing

Cropping, resizing and format conversion. A 2MB limit and `next/image` doing the
downscaling is enough for a 32px circle, and an in-browser cropper is a feature
in its own right rather than part of this one.

## Error handling

### A boundary is a decision about blast radius

It is easy to wrap everything in error boundaries and feel safer without being
safer. A boundary decides how much of the tree dies when something throws, so
each one here is placed where the damage should stop, not wherever an error
might occur.

The one that matters is around each **element on the canvas**. The canvas draws
user content, and losing it means losing the only way to select and repair the
element that broke it — along with every unsaved edit sitting in the store
behind it. So one element that throws becomes one dashed red box, still
selectable, in the place the element was.

### The editor and the renderer want opposite things from the same failure

`ProjectComposition` takes `isolateElements`, and the editor is the only caller
that passes it.

In the editor, containment is obviously right. In a render it is obviously
wrong: a contained failure would silently bake a placeholder into a video
someone is about to publish. There the throw should propagate, so the export
reports a failed render instead of producing a file with a red box in it. The
same component, two callers, opposite requirements — which is why it is a prop
and not a default.

### A boundary that has caught, stays caught

Until something tells it otherwise. That is the subtle failure: the user fixes
the element, and the fallback is still there, so the fix looks like it did not
work. `resetKeys` is what closes that loop, and on the canvas the key is the
element object itself — the store replaces it on every edit, so changing
anything about a broken element makes it try again.

### Four boundaries, four different messages

- `app/global-error.tsx` — the root layout itself failed, so this replaces the
  document and ships its own `<html>`, `<body>` and inline styles. It cannot use
  the design tokens or the fonts, because those are among the things that may
  have been what failed.
- `app/error.tsx` — anything else with no closer boundary.
- `app/(app)/error.tsx` — a segment boundary keeps the layout above it, so the
  header and its navigation survive and there is still a way out. The root
  boundary replaces all of that and leaves someone on a dead page.
- `.../editor/error.tsx` — the editor gets its own because the honest message is
  different: the working copy lives in a store inside this segment, so unsaved
  edits are gone by the time it renders. Saying "try again" without saying that
  would be misleading.

### The not-found page was unreachable for the people most likely to need it

The proxy listed *public* paths and gated everything else, which quietly meant
that any path matching no route at all counted as protected. A signed-out
visitor following a stale link met a login form, and after signing in was
delivered to the 404 they were always going to get.

It now lists the protected prefixes instead. The usual objection — forgetting to
add a route makes it public — is not the failure mode here: every page in the
signed-in group renders under a layout that calls `requireUser()`, so the server
redirects regardless. This gate exists to avoid rendering a page that is about
to be thrown away, not to be the only lock. `tests/core/route-gate.test.ts` pins
both directions, and `e2e/auth-gate.spec.ts` walks every protected route from a
browser.

Matching is by path segment, not string prefix, so `/dashboardextra` is not
inside `/dashboard`.

### What was already right

Worth recording, because it is the reason this section is not longer:

- **Stored JSON never throws on the way in.** `parseOrDefault` in the mappers
  validates every blob and falls back to defaults, so a corrupt config costs one
  config rather than the project, and dangling connectors are pruned on load.
- **Autosave already degrades well.** It debounces, guards against overlapping
  saves, reports failure without discarding the working copy, and warns before
  the tab closes with unsaved work.
- **A project that is not yours is a 404, not a 403.** Anything else confirms
  the project exists.

## Explaining the properties panel

The panel is 288px wide and holds forty-odd controls, so the constraint on any
help affordance is that it must cost nothing when it is not wanted. Three
choices follow.

### It lives in space that was already empty

Every label in the panel is one or two words with an empty third of a row after
it. A quiet `ⓘ` there fills space nothing was using, rather than competing with
the controls. The alternative — hint text under each field — would roughly
double the height of the panel permanently, to answer a question most users have
once.

### The description is attached to the input, not only to the tooltip

This is the part that is easy to skip and matters most. `aria-describedby` on
the control means a screen reader reads the explanation when the user lands on
the field. Without it, the sighted path and the assistive path would be two
different features and the assistive one would be much worse — discover a
tooltip, tab to it, read it, tab back.

So the description element is always rendered, whether or not the tooltip is
open. A description that existed only while a tooltip was visible would reach
only the people who had already found the tooltip.

### The popover is `fixed`, and closes on scroll

The panel is a scroll container, and a scroll container clips its children in
both directions — `overflow-y: auto` forces `overflow-x` to clip too. An
absolutely positioned tooltip would be readable next to `Duration` and sliced in
half next to `Height`, which sits in the right-hand column of a two-column row
against the window's edge.

Fixed positioning leaves the container entirely. The cost is that it does not
follow scrolling, so it closes on scroll rather than drifting away from its
field. `placePopover` is a pure function and is unit-tested, because jsdom has
no layout engine and this is the kind of geometry that is wrong only on the
screen.

### The copy is the feature

A tooltip on `Duration` reading "the duration" has cost a hover and said
nothing. The ones worth having answer a question someone would otherwise answer
by experiment:

- changing export frame rate **resamples** the animation rather than retiming it
- a mismatched export aspect ratio is **fitted and centred**, never cropped
- the composition theme is **not** the editor's theme

All of it lives in one file so the whole set can be read as a piece and kept in
one voice, and the tests assert the writing as well as the markup: long enough
to explain, short enough to read, written as sentences, and — for the three
above — actually containing the surprise.

### Opens on hover, focus and click

Hover for the common case, focus so a keyboard user gets the same thing, and
click to pin it open for reading at length or for a touch screen. Escape closes
it and stops the event, so dismissing a tooltip does not also clear the canvas
selection through the editor's global shortcut handler.
