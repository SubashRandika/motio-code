import { countUp, fadeIn, focusRange, revealParts, slideFrom } from "@/core/animation";
import { typewriterFrames } from "@/core/code";
import type { ContentType, Scene } from "@/core/model";

import {
  diagramScene,
  make,
  ordered,
  sceneOf,
  seconds,
  type TemplateContext,
} from "./builders";

/**
 * The ten starter templates.
 *
 * A template is **code, not stored data.** It only has to run once, at the moment
 * a project is created, and after that the user owns ordinary scenes. A table of
 * template JSON would need migrating every time the element schema grew, and
 * would let a template hold an element shape the current code cannot render --
 * for a fixed set of starting points that is cost with no benefit. The trade-off
 * flips if users can ever save their own templates, which is a later phase.
 *
 * Each is a function from a canvas to scenes, so the same template lays out on
 * every aspect ratio the product offers.
 */

export interface Template {
  /** Stored in `projects.template_id`, so it must stay stable. */
  id: string;
  name: string;
  description: string;
  /** Which content choice offers it. */
  contentType: ContentType;
  build: (context: TemplateContext) => Scene[];
}

/* ------------------------------------------------------------------ pieces */

/** The opening title every template starts with, so a project is never blank. */
function titleScene(
  context: TemplateContext,
  options: { name: string; title: string; subtitle: string },
): Scene {
  const { canvas } = context;
  const settle = seconds(canvas, 0.5);

  return sceneOf({
    name: options.name,
    durationInFrames: seconds(canvas, 3),
    elements: [
      make(
        "text",
        context,
        {
          name: "Title",
          at: { x: 0.08, y: 0.36, width: 0.84, height: 0.16 },
          content: {
            text: options.title,
            font: "display",
            fontSize: Math.round(canvas.height * 0.085),
            fontWeight: 600,
            color: context.theme.text,
          },
          animations: [fadeIn(settle), slideFrom("up", settle, Math.round(canvas.height * 0.03))],
        },
      ),
      make(
        "text",
        context,
        {
          name: "Subtitle",
          at: { x: 0.08, y: 0.54, width: 0.72, height: 0.1 },
          content: {
            text: options.subtitle,
            fontSize: Math.round(canvas.height * 0.032),
            fontWeight: 400,
            color: context.theme.muted,
          },
          animations: [
            fadeIn(settle, { offsetInFrames: Math.round(settle * 0.6) }),
            slideFrom("up", settle, Math.round(canvas.height * 0.02), {
              offsetInFrames: Math.round(settle * 0.6),
            }),
          ],
        },
      ),
    ],
  });
}

/** A caption strip, for the explanation that runs alongside a diagram or panel. */
function caption(
  context: TemplateContext,
  options: { label: string; body: string; at?: { x: number; y: number; width: number; height: number }; offsetInFrames?: number },
) {
  return make("callout", context, {
    name: "Caption",
    at: options.at ?? { x: 0.08, y: 0.8, width: 0.5, height: 0.12 },
    content: { label: options.label, body: options.body, tone: "accent" },
    style: { fill: context.theme.surface, cornerRadius: 8 },
    animations: [fadeIn(seconds(context.canvas, 0.4), { offsetInFrames: options.offsetInFrames ?? 0 })],
  });
}

/** A diagram scene wired the way every diagram template wants it. */
function animatedDiagram(
  context: TemplateContext,
  options: {
    name: string;
    source: string;
    label: string;
    body: string;
    lengthInSeconds?: number;
    flow?: boolean;
  },
): Scene {
  const { canvas } = context;
  const step = seconds(canvas, 0.4);

  return diagramScene(context, {
    name: options.name,
    durationInFrames: seconds(canvas, options.lengthInSeconds ?? 7),
    source: options.source,
    revealNodes: { durationInFrames: step, staggerInFrames: step },
    flowRoutes: options.flow ? { durationInFrames: seconds(canvas, 2), markers: 2, repeat: 2 } : undefined,
    overlay: [caption(context, { label: options.label, body: options.body })],
  });
}

/* --------------------------------------------------------------- templates */

const CODE_WALKTHROUGH_SOURCE = `export async function handler(request: Request) {
  const token = request.headers.get("authorization");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await verify(token);
  return Response.json({ user });
}`;

const codeWalkthrough: Template = {
  id: "code-walkthrough",
  name: "Code walkthrough",
  description: "A panel that reveals line by line, then steps a focus down the code.",
  contentType: "code",
  build: (context) => {
    const { canvas, theme } = context;
    const lineCount = CODE_WALKTHROUGH_SOURCE.split("\n").length;
    const reveal = seconds(canvas, 2);
    const stepLength = seconds(canvas, 1.6);

    const steps = [
      { from: 2, to: 4, label: "Guard", body: "Reject the request before doing any work." },
      { from: 7, to: 8, label: "Verify", body: "Only now is the token worth the round trip." },
    ];

    return ordered([
      titleScene(context, {
        name: "Title",
        title: "How the auth handler works",
        subtitle: "Three decisions, in the order the runtime makes them.",
      }),

      sceneOf({
        name: "The code",
        durationInFrames: reveal + stepLength * steps.length + seconds(canvas, 1),
        elements: [
          make("code", context, {
            name: "Handler",
            at: { x: 0.08, y: 0.1, width: 0.84, height: 0.62 },
            content: {
              code: CODE_WALKTHROUGH_SOURCE,
              language: "typescript",
              title: "handler.ts",
              revealUnit: "line",
              fontSize: Math.round(canvas.height * 0.026),
            },
            animations: [
              revealParts(reveal, reveal / lineCount),
              ...steps.map((step, index) =>
                focusRange({
                  fromPart: step.from,
                  toPart: step.to,
                  offsetInFrames: reveal + index * stepLength,
                  durationInFrames: seconds(canvas, 0.4),
                  accent: theme.accent,
                }),
              ),
            ],
          }),
          ...steps.map((step, index) =>
            caption(context, {
              label: step.label,
              body: step.body,
              at: { x: 0.08, y: 0.78, width: 0.6, height: 0.14 },
              offsetInFrames: reveal + index * stepLength,
            }),
          ),
        ],
      }),
    ]);
  },
};

const beforeAfterCode: Template = {
  id: "before-after-code",
  name: "Before and after",
  description: "Two panels side by side, the second arriving once the first has landed.",
  contentType: "code",
  build: (context) => {
    const { canvas } = context;
    const settle = seconds(canvas, 0.5);
    const arrive = seconds(canvas, 2);

    const before = `const users = [];
for (const row of rows) {
  if (row.active) {
    users.push(row.name);
  }
}`;

    const after = `const users = rows
  .filter((row) => row.active)
  .map((row) => row.name);`;

    return ordered([
      titleScene(context, {
        name: "Title",
        title: "Before and after",
        subtitle: "The same result, five lines shorter.",
      }),

      sceneOf({
        name: "Comparison",
        durationInFrames: seconds(canvas, 7),
        elements: [
          make("code", context, {
            name: "Before",
            at: { x: 0.04, y: 0.18, width: 0.44, height: 0.6 },
            content: { code: before, title: "Before", language: "typescript" },
            animations: [fadeIn(settle), slideFrom("left", settle, Math.round(canvas.width * 0.03))],
          }),
          make("code", context, {
            name: "After",
            at: { x: 0.52, y: 0.18, width: 0.44, height: 0.6 },
            from: arrive,
            content: { code: after, title: "After", language: "typescript" },
            animations: [fadeIn(settle), slideFrom("right", settle, Math.round(canvas.width * 0.03))],
          }),
          caption(context, {
            label: "Why",
            body: "The intent is now in the method names, not in the control flow.",
            at: { x: 0.04, y: 0.82, width: 0.6, height: 0.12 },
            offsetInFrames: arrive + settle,
          }),
        ],
      }),
    ]);
  },
};

const apiRequestLifecycle: Template = {
  id: "api-request-lifecycle",
  name: "API request lifecycle",
  description: "A request travelling from client to database and back, with flow markers.",
  contentType: "diagram",
  build: (context) =>
    ordered([
      titleScene(context, {
        name: "Title",
        title: "The life of a request",
        subtitle: "From the client to the database and back again.",
      }),
      animatedDiagram(context, {
        name: "Request path",
        label: "Path",
        body: "Every hop is a place the request can fail, and a place you can cache.",
        flow: true,
        source: `flowchart LR
  Client[Client] --> Gateway[API Gateway]
  Gateway --> Auth{Authorised?}
  Auth -->|yes| Service[Orders Service]
  Auth -->|no| Reject[401 Unauthorized]
  Service --> Db[(Orders DB)]`,
      }),
    ]),
};

const microservices: Template = {
  id: "microservices-architecture",
  name: "Microservices architecture",
  description: "Services behind a gateway, talking through an event bus.",
  contentType: "diagram",
  build: (context) =>
    ordered([
      titleScene(context, {
        name: "Title",
        title: "How the services fit together",
        subtitle: "One gateway, three services, one bus.",
      }),
      animatedDiagram(context, {
        name: "Services",
        label: "Shape",
        body: "The bus is what keeps the services from having to know about each other.",
        flow: true,
        source: `flowchart TB
  Web[Web App] --> Gateway[API Gateway]
  Gateway --> Orders[Orders]
  Gateway --> Billing[Billing]
  Orders --> Bus{{Event Bus}}
  Billing --> Bus
  Bus --> Email[Email Worker]`,
      }),
    ]),
};

const cloudInfrastructure: Template = {
  id: "cloud-infrastructure",
  name: "Cloud infrastructure overview",
  description: "Edge, compute and storage tiers, revealed one layer at a time.",
  contentType: "diagram",
  build: (context) =>
    ordered([
      titleScene(context, {
        name: "Title",
        title: "What runs where",
        subtitle: "The infrastructure behind a single page load.",
      }),
      animatedDiagram(context, {
        name: "Infrastructure",
        label: "Tiers",
        body: "Traffic only reaches compute when the edge cannot answer it.",
        source: `flowchart TB
  Users[Users] --> Cdn[CDN Edge]
  Cdn --> Lb[Load Balancer]
  Lb --> App[App Servers]
  App --> Cache[(Redis Cache)]
  App --> Db[(Primary DB)]
  Db --> Backup[(Backups)]`,
      }),
    ]),
};

const eventDriven: Template = {
  id: "event-driven-architecture",
  name: "Event-driven architecture",
  description: "A producer, a topic and the consumers that fan out from it.",
  contentType: "diagram",
  build: (context) =>
    ordered([
      titleScene(context, {
        name: "Title",
        title: "One event, many readers",
        subtitle: "Why the producer does not know who is listening.",
      }),
      animatedDiagram(context, {
        name: "Events",
        label: "Fan-out",
        body: "Adding a consumer changes nothing about the producer.",
        flow: true,
        source: `flowchart LR
  Checkout[Checkout] --> Topic{{order.placed}}
  Topic --> Inventory[Inventory]
  Topic --> Invoicing[Invoicing]
  Topic --> Analytics[Analytics]
  Inventory --> Store[(Stock DB)]`,
      }),
    ]),
};

const authenticationFlow: Template = {
  id: "authentication-flow",
  name: "Authentication flow",
  description: "Sign-in from the browser to the session cookie, step by step.",
  contentType: "diagram",
  build: (context) =>
    ordered([
      titleScene(context, {
        name: "Title",
        title: "How sign-in works",
        subtitle: "Where the token comes from, and where it is checked.",
      }),
      animatedDiagram(context, {
        name: "Sign-in",
        label: "Trust",
        body: "The token is verified on every request, not just at sign-in.",
        flow: true,
        source: `flowchart LR
  Browser[Browser] --> Login[Login Form]
  Login --> Auth[Auth Service]
  Auth --> Users[(Users)]
  Auth --> Token{{Access Token}}
  Token --> Api[Protected API]`,
      }),
    ]),
};

const dataPipeline: Template = {
  id: "data-pipeline",
  name: "Data pipeline",
  description: "Extract, transform and load, with data visibly moving between stages.",
  contentType: "diagram",
  build: (context) =>
    ordered([
      titleScene(context, {
        name: "Title",
        title: "How the nightly pipeline runs",
        subtitle: "Four stages, one direction.",
      }),
      animatedDiagram(context, {
        name: "Pipeline",
        label: "Stages",
        body: "Each stage is restartable, which is what makes a failure survivable.",
        flow: true,
        source: `flowchart LR
  Source[(Source DB)] --> Extract[Extract]
  Extract --> Transform[Transform]
  Transform --> Validate{Valid?}
  Validate -->|yes| Warehouse[(Warehouse)]
  Validate -->|no| Quarantine[(Quarantine)]
  Warehouse --> Dash[Dashboard]`,
      }),
    ]),
};

const databaseQuery: Template = {
  id: "database-query-execution",
  name: "Database query execution",
  description: "A SQL statement beside the path the planner takes to answer it.",
  contentType: "mixed",
  build: (context) => {
    const { canvas } = context;
    const query = `select o.id, o.total, c.name
from orders o
join customers c on c.id = o.customer_id
where o.created_at > now() - interval '7 days'
order by o.total desc
limit 20;`;

    return ordered([
      titleScene(context, {
        name: "Title",
        title: "What the planner actually does",
        subtitle: "Six lines of SQL, four steps of work.",
      }),

      sceneOf({
        name: "The query",
        durationInFrames: seconds(canvas, 6),
        elements: [
          make("code", context, {
            name: "Query",
            at: { x: 0.08, y: 0.14, width: 0.84, height: 0.5 },
            content: {
              code: query,
              language: "sql",
              title: "recent-orders.sql",
              revealUnit: "character",
              showCaret: true,
              fontSize: Math.round(canvas.height * 0.028),
            },
            animations: [revealParts(Math.min(typewriterFrames(query, canvas.fps), seconds(canvas, 4)))],
          }),
          caption(context, {
            label: "Read it",
            body: "The order of the clauses is not the order they run in.",
            at: { x: 0.08, y: 0.72, width: 0.6, height: 0.12 },
            offsetInFrames: seconds(canvas, 3.5),
          }),
        ],
      }),

      animatedDiagram(context, {
        name: "Execution",
        label: "Plan",
        body: "The limit is applied last, which is why the sort costs so much.",
        lengthInSeconds: 7,
        source: `flowchart LR
  Scan[Index Scan on orders] --> Join[Hash Join customers]
  Join --> Filter{created_at in range}
  Filter --> Sort[Sort by total]
  Sort --> Limit[Limit 20]`,
      }),
    ]);
  },
};

const conceptInfographic: Template = {
  id: "technical-concept-infographic",
  name: "Technical concept infographic",
  description: "A headline number, a before-and-after chart and the steps that got you there.",
  contentType: "infographic",
  build: (context) => {
    const { canvas, theme } = context;
    const count = seconds(canvas, 1.5);
    const stagger = seconds(canvas, 0.5);

    return ordered([
      titleScene(context, {
        name: "Title",
        title: "What caching bought us",
        subtitle: "One change, measured over a fortnight.",
      }),

      sceneOf({
        name: "The numbers",
        durationInFrames: seconds(canvas, 6),
        elements: [
          make("counter", context, {
            name: "Latency drop",
            at: { x: 0.06, y: 0.16, width: 0.4, height: 0.28 },
            content: {
              value: 71,
              decimals: 0,
              suffix: "%",
              label: "Faster at the 95th percentile",
              fontSize: Math.round(canvas.height * 0.13),
              align: "left",
            },
            animations: [fadeIn(seconds(canvas, 0.4)), countUp(count)],
          }),
          make("chart", context, {
            name: "Response time",
            at: { x: 0.54, y: 0.16, width: 0.4, height: 0.4 },
            content: {
              bars: [
                { label: "Before", value: 820, color: theme.muted },
                { label: "After", value: 240, color: theme.accent },
              ],
              suffix: "ms",
              showValues: true,
            },
            animations: [countUp(count, { offsetInFrames: stagger }), revealParts(count)],
          }),
          make("progress", context, {
            name: "Hit rate",
            at: { x: 0.06, y: 0.5, width: 0.4, height: 0.12 },
            content: { value: 94, max: 100, label: "Cache hit rate", suffix: "%" },
            animations: [fadeIn(seconds(canvas, 0.4), { offsetInFrames: stagger }), countUp(count)],
          }),
          make("steps", context, {
            name: "How",
            at: { x: 0.06, y: 0.66, width: 0.88, height: 0.26 },
            content: {
              orientation: "horizontal",
              steps: [
                { title: "Measure", detail: "Find the slow endpoint first." },
                { title: "Cache", detail: "Read-through, with a short TTL." },
                { title: "Verify", detail: "Compare the same percentile." },
              ],
              fontSize: Math.round(canvas.height * 0.026),
            },
            animations: [revealParts(seconds(canvas, 1.5), stagger, { offsetInFrames: count })],
          }),
        ],
      }),
    ]);
  },
};

/** Listed in the order the picker shows them, blank first in the UI. */
export const TEMPLATES: readonly Template[] = [
  codeWalkthrough,
  beforeAfterCode,
  apiRequestLifecycle,
  microservices,
  cloudInfrastructure,
  databaseQuery,
  eventDriven,
  authenticationFlow,
  dataPipeline,
  conceptInfographic,
];

export function findTemplate(id: string): Template | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

/** The templates offered for a content type. */
export function templatesFor(contentType: ContentType): Template[] {
  return TEMPLATES.filter((template) => template.contentType === contentType);
}
