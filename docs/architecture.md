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
core/render/      the project-to-composition mapping: output size, frame rate, resampling
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

### Licensing, before it becomes expensive

Remotion is not MIT. It is free for individuals and organisations of up to three
people, explicitly including commercial use, SaaS and automations; above that it
is $0.01 per render with a $100/month minimum. The threshold is headcount, not
revenue, and the render-based tier is exactly what a product that renders videos
for its users falls into. `docs/decisions/remotion-licensing.md` records the
terms as they were read, with dates.

## Schema evolution

Stored scenes outlive the code that wrote them. Two rules:

- A new field on an existing schema must carry a default, so an older row still
  parses. `tests/core/backward-compatibility.test.ts` pins a real pre-diagram
  scene verbatim and fails if that stops being true.
- A new element kind is additive to the `sceneElementSchema` union, and nothing
  else in the engine changes. So is a new animation kind: `tests/core/persistence.test.ts`
  iterates `ANIMATION_TYPES` rather than a hand-written list, so one cannot be
  added without being covered.

A connector is excluded from `createElement`'s input type rather than left as a
branch that could only produce an invalid element — it is drawn between two
existing nodes, never added from the rail.

Two exhaustive maps and one `never` assignment do the enforcing. `ELEMENT_LABELS`
and `ELEMENT_ICONS` are `Record<ElementType, …>`, and `ElementContent` ends by
assigning the narrowed element to `never`. A new element kind therefore fails to
compile in three places until it has a label, an icon and something to draw,
instead of quietly rendering nothing.

## Design system

Dark-first, two accents used in strictly separate roles so colour carries
meaning:

- **amber** — the user and their actions (brand, buttons, selection)
- **cyan** — time and the machine (playhead, timecodes, render status)

Tokens live in `app/globals.css` under `@theme`. Frame counts and timecodes use
the `.tabular` class so digits never shift as the playhead moves.

Composition themes (`core/model/theme.ts`) are separate from the application's
own chrome, so a user can build a light-themed video inside a dark editor.
