# MASTER PROMPT — MotioCode

## Animated Technical Storytelling SaaS Platform

---

# 1. ROLE AND RESPONSIBILITIES

Act as a senior product architect, SaaS product designer, full-stack software engineer, motion-design specialist, and technical lead.

Your responsibility is to design and implement **MotioCode**, a modern browser-based SaaS platform that enables technical professionals to transform complex engineering concepts into clear, engaging, animated visual content.

You must approach this project as a real SaaS product, emphasizing:

- Excellent user experience.
- Maintainable and modular architecture.
- Strong TypeScript type safety.
- Reliable project persistence.
- Consistent animation behavior.
- High-quality visual output.
- Security and data ownership.
- Incremental implementation and testing.

Do not attempt to build every feature at once.

Start with a well-defined MVP, validate the complete content creation workflow, and extend the platform through clearly separated development phases.

---

# 2. PRODUCT IDENTITY

## Product Name

MotioCode

## Tagline

Bring Your Code and Ideas to Life.

## Product Vision

MotioCode is a technical motion-design studio that helps software engineers and technical professionals communicate complex ideas visually.

Users should be able to create animated code explanations, software architecture diagrams, infrastructure diagrams, flowcharts, and technical infographics without needing professional motion-design skills.

The product combines a visual editor, optional code-based configuration, a scene-based animation system, and video export capabilities.

## Core Value Proposition

Turn complex technical concepts into clear, engaging, and shareable animated visual stories.

## Target Audience

Primary users:

- Front-end and full-stack developers.
- Backend engineers.
- Software architects and engineering leads.
- DevOps and cloud infrastructure engineers.
- Technical educators and developer advocates.
- Technical content creators.

The product should be designed for technically capable users who understand the concepts they want to explain but may not have experience with animation software.

## Primary Use Cases

- Explain code execution and programming concepts.
- Visualize API request and response lifecycles.
- Demonstrate software architecture and infrastructure.
- Explain microservices communication.
- Illustrate event-driven systems and data pipelines.
- Present technical comparisons and engineering metrics.
- Create educational videos and technical social media content.
- Produce professional technical presentations and demonstrations.

---

# 3. MVP PRODUCT SCOPE

The first MVP must support three core content creation experiences:

1. Animated Code Studio.
2. Animated Diagram Studio.
3. Animated Infographic Studio.

All three experiences should use a shared project model, scene management system, animation model, preview mechanism, and export architecture.

The editor must provide a **hybrid editing experience**:

- Visual editing through a canvas, properties panel, and timeline.
- Optional code/configuration editing for supported content types.
- A structured internal project model that keeps visual content editable.

For diagrams, support both visual drag-and-drop editing and text-based diagram definitions.

For video rendering, begin with browser-based preview and a rendering architecture that can support a dedicated server-side rendering service in a later phase.

## MVP Scope Boundaries

The MVP should include:

- Authentication and user accounts.
- Project dashboard.
- Project creation, saving, loading, and deletion.
- Scene-based editing.
- Basic visual canvas and timeline.
- Animated code snippets.
- Basic architecture diagrams and flowcharts.
- Basic animated infographics.
- Reusable animation presets and starter templates.
- Browser-based preview.
- A practical export prototype.
- Responsive dashboard and desktop-first editor.

Do not include advanced AI generation, real-time collaboration, a public social network, a template marketplace, or complex subscription billing in the initial MVP.

---

# 4. TECHNOLOGY STACK

Use the following primary technology stack.

## Frontend

- Next.js with App Router.
- React.
- TypeScript with strict type checking.
- Tailwind CSS.
- Framer Motion for UI interactions and lightweight interface animations.
- GSAP only where complex timeline-driven DOM animation provides a clear benefit.
- Zustand for editor state management.
- Zod for schema validation.

## Animation and Rendering

- Remotion for composition-based animation and video rendering.
- A shared animation model that can drive the editor preview and Remotion compositions.
- A deterministic timeline system based on frame numbers or normalized time.

Do not make the editor depend on browser animation state that cannot be reproduced during video rendering.

## Diagram Editing

- React Flow for node-based editing where appropriate.
- A structured diagram data model independent of the canvas library.
- Support for visual diagram editing and text-based definitions.

## Code Editing

- Monaco Editor or CodeMirror for code editing.
- Shiki or another suitable syntax-highlighting solution.
- Support for common programming languages.

## Backend and Database

- Supabase Auth for authentication.
- Supabase PostgreSQL for structured data.
- Supabase Storage for assets and rendered output.
- Supabase Row Level Security for access control.

## Testing

- Vitest for unit testing.
- React Testing Library for component testing.
- Playwright for end-to-end testing.

Use the simplest practical implementation for the MVP and avoid unnecessary dependencies.

---

# 5. APPLICATION STRUCTURE

Create the following main application areas.

## Public Pages

- Landing page.
- Product overview.
- Sign-up page.
- Login page.
- Password reset page.

## Authenticated Application

- Dashboard.
- Project creation flow.
- Project editor.
- Project settings.
- Account profile and settings.
- Export status and history.

## Application Routes

Use a clear, maintainable route structure such as:

- `/` — Landing page.
- `/login` — Login.
- `/signup` — Registration.
- `/dashboard` — User dashboard.
- `/projects/new` — New project creation.
- `/projects/[projectId]/editor` — Project editor.
- `/projects/[projectId]/settings` — Project settings.
- `/settings/profile` — Profile settings.

Protect authenticated routes and verify authorization on the server.

---

# 6. CORE MODULE A — ANIMATED CODE STUDIO

Create an editor that allows users to transform code snippets into animated explanations.

## Features

- Code editor with syntax highlighting.
- Support for TypeScript, JavaScript, Python, C#, Java, and SQL.
- Add code snippets to scenes.
- Edit code directly in the visual editor.
- Configure code panel appearance.
- Animate code appearing line by line.
- Highlight selected lines.
- Emphasize specific tokens or code blocks where practical.
- Animate cursor movement and focus indicators.
- Add explanatory captions and callouts.
- Configure font family, font size, line height, theme, and panel styling.
- Preview animations in real time.

## Initial Animation Presets

1. Typewriter reveal.
2. Line-by-line reveal.
3. Highlight and explain.
4. Code walkthrough.
5. Before-and-after comparison.
6. Sequential code transformation.

## MVP Constraints

Focus on readable code presentation and simple, deterministic animations.

Do not implement actual code execution or a full debugging environment in the MVP.

Code animation should be driven by the project's shared animation timeline.

---

# 7. CORE MODULE B — ANIMATED DIAGRAM STUDIO

Create an interactive diagram editor for explaining technical systems and workflows.

## Initial Diagram Types

- Software architecture diagrams.
- Infrastructure diagrams.
- Flowcharts.
- API request and response flows.
- Basic sequence diagrams.
- Data pipelines.

Additional specialized diagram types can be added later.

## Visual Diagram Editing

Users should be able to:

- Add, edit, move, resize, and delete nodes.
- Create connections between nodes.
- Configure node labels, icons, shapes, and colors.
- Configure connection labels, arrows, and styles.
- Select multiple elements where practical.
- Arrange and align elements.
- Pan and zoom the canvas.
- Configure diagram themes.
- Add explanatory captions and callouts.
- Duplicate and delete diagram elements.

## Animated Diagram Features

- Highlight nodes in sequence.
- Animate connections and flow indicators.
- Animate data moving between nodes.
- Emphasize a selected component.
- Reveal diagram elements progressively.
- Animate request and response paths.
- Synchronize diagram animations with explanatory captions.

## Text-Based Diagram Definitions

Support text-based diagram definitions for selected diagram types.

Evaluate Mermaid as the initial text-based diagram format for supported diagrams.

Provide a clear workflow for:

- Writing or editing diagram definitions.
- Parsing and validating definitions.
- Rendering the resulting diagram.
- Synchronizing supported changes with the visual editor.
- Displaying validation errors without losing user input.

Do not assume that every visual editing operation can be converted back into text-based syntax.

Where bidirectional synchronization is not practical, clearly define which editing mode is authoritative and how users switch between modes.

## MVP Constraints

Start with architecture diagrams and flowcharts.

Implement a small, reliable set of diagram features before expanding into advanced UML functionality.

---

# 8. CORE MODULE C — ANIMATED INFOGRAPHIC STUDIO

Create an editor for producing animated technical infographics.

## Initial Elements

- Text and headings.
- Cards and callouts.
- Numbers and counters.
- Progress indicators.
- Basic bar charts.
- Comparison layouts.
- Timeline graphics.
- Step-by-step process elements.
- Shapes and icons.

## Animation Features

- Fade and slide transitions.
- Animated counters.
- Sequential element reveals.
- Basic chart transitions.
- Emphasis and highlight effects.
- Scene transitions.

## Editing Features

- Edit displayed data.
- Configure typography and colors.
- Adjust positioning and dimensions.
- Configure visual themes.
- Add explanatory text.
- Preview the complete animation.

Keep the initial infographic module focused on common technical storytelling patterns rather than implementing a complete charting or presentation platform.

Ensure that animated values and chart representations remain faithful to the underlying data.

---

# 9. HYBRID EDITOR EXPERIENCE

The MotioCode editor must combine visual editing with optional code/configuration editing.

## Editor Layout

### Left Sidebar

Include:

- Scene list.
- Content elements.
- Templates.
- Assets.
- Shapes and icons.
- Code snippets.
- Diagram components.

### Main Canvas

Include:

- Central composition preview.
- Selectable visual elements.
- Canvas guides and alignment.
- Zoom and pan.
- Aspect ratio settings.
- Background and theme settings.

### Right Properties Panel

Include:

- Selected element properties.
- Position and dimensions.
- Typography and styling.
- Colors and visual settings.
- Animation configuration.
- Timing and duration settings.
- Element-specific options.

### Bottom Timeline

Include:

- Scene timeline.
- Element tracks.
- Animation start and end times.
- Scene duration.
- Playhead.
- Playback controls.
- Timeline zoom.
- Scene transitions.

## Code/Configuration Panel

Provide an optional panel for editing structured project or element configuration.

Use validated schemas and clear error reporting.

Avoid requiring users to write code to perform common editing operations.

## Editor Behavior

- Selecting an element should display its properties.
- Changes in the properties panel should update the canvas.
- Supported configuration edits should update the visual representation.
- Scene changes should update the active timeline.
- The preview should reflect the shared animation model.
- Persist changes through the project save mechanism.

Prioritize desktop editing while keeping the dashboard and project viewing experience responsive.

---

# 10. PROJECT, SCENE, AND ANIMATION DATA MODEL

Create a stable and extensible internal data model.

A project should contain:

- Project metadata.
- Canvas configuration.
- Theme configuration.
- Content type.
- A collection of scenes.
- Asset references.
- Export configuration.

Each scene should contain:

- Stable scene identifier.
- Scene name.
- Scene duration.
- Scene elements.
- Animation definitions.
- Transition configuration.
- Scene ordering.

Each visual element should contain:

- Stable element identifier.
- Element type.
- Position and dimensions.
- Layer or stacking order.
- Content data.
- Styling properties.
- Animation definitions.
- Start time and duration.

## Animation Model

Define a declarative animation model.

Support:

- Fade.
- Slide.
- Scale.
- Highlight.
- Sequential reveal.
- Element emphasis.
- Motion along diagram connections.
- Scene transitions.

Represent animation timing consistently using frames or a normalized timeline.

Define how overlapping animations, element visibility, scene boundaries, and transitions are handled.

## State Management

Use Zustand to manage editor state.

Separate:

- Persisted project data.
- Temporary editing state.
- Selection and focus state.
- Timeline playback state.
- UI panel state.
- Save and synchronization status.

Avoid unnecessary global state and excessive rerendering.

---

# 11. VIDEO PREVIEW AND EXPORT

Use Remotion as the primary rendering technology.

## MVP Preview

Implement a browser-based preview that reflects the shared project model.

The preview should support:

- Play and pause.
- Seeking through the timeline.
- Scene transitions.
- Animation timing.
- Visual element visibility.
- Basic preview quality settings.

Keep preview behavior deterministic and consistent with the eventual rendering pipeline.

## Export Prototype

Build an initial export workflow that validates the project-to-composition mapping and produces a practical downloadable output where browser capabilities permit.

Support the following intended formats:

- 16:9 landscape.
- 1:1 square.
- 9:16 portrait.
- 4:5 portrait.

Provide configurable frame rate and resolution where supported.

## Rendering Architecture

Design the application so a dedicated server-side rendering service can be added later.

The initial MVP must not depend on a fully developed distributed rendering infrastructure.

Separate:

- Project composition generation.
- Preview playback.
- Render job creation.
- Render job status.
- Final output storage.
- Download authorization.

Before commercial deployment, investigate Remotion licensing, supported rendering environments, infrastructure costs, and operational requirements.

---

# 12. AUTHENTICATION AND ACCOUNT MANAGEMENT

Use Supabase Auth.

Implement:

- Email and password registration.
- Login and logout.
- Email verification.
- Password reset.
- User profile management.
- Protected routes.
- Persistent authenticated sessions.

Plan the architecture so OAuth providers such as Google and GitHub can be added later.

Every user's projects and private assets must be protected by ownership and authorization checks.

---

# 13. DATABASE AND STORAGE DESIGN

Use Supabase PostgreSQL for structured application data.

Create the following initial entities.

## profiles

- id
- display_name
- avatar_url
- created_at
- updated_at

## projects

- id
- owner_id
- name
- description
- content_type
- canvas_config
- theme_config
- created_at
- updated_at

## project_scenes

- id
- project_id
- name
- scene_order
- duration
- scene_data
- created_at
- updated_at

## assets

- id
- owner_id
- project_id
- asset_type
- storage_path
- metadata
- created_at

## render_jobs

- id
- project_id
- owner_id
- status
- render_settings
- output_path
- error_message
- created_at
- updated_at

Use UUID identifiers, appropriate indexes, foreign keys, and timestamps.

Implement Row Level Security policies for user-owned records.

Use Supabase Storage for project assets and rendered video files.

Avoid storing large media files directly in PostgreSQL.

Review the data model before implementation and refine it to avoid unnecessary duplication or excessive JSON storage.

---

# 14. DASHBOARD AND PROJECT MANAGEMENT

Create a clean and professional dashboard.

## Dashboard Features

- Recent projects.
- Create new project.
- Starter templates.
- Project cards with thumbnails.
- Search projects.
- Rename projects.
- Duplicate projects.
- Delete projects with confirmation.
- Display project creation and update timestamps.
- Show export history where available.

## Project Creation Flow

Allow users to:

1. Create a blank project.
2. Choose a content type.
3. Select a starter template.
4. Configure canvas dimensions.
5. Enter a project name.
6. Open the editor.

Make it easy to resume unfinished work.

---

# 15. STARTER TEMPLATES

Create a reusable template system.

Initial templates:

1. Code walkthrough.
2. API request lifecycle.
3. Microservices architecture.
4. Cloud infrastructure overview.
5. Database query execution.
6. Event-driven architecture.
7. Authentication flow.
8. Data pipeline.
9. Before-and-after code comparison.
10. Technical concept infographic.

Each template should contain editable scenes, visual elements, styling, and animation presets.

Templates should be reusable starting points rather than fixed videos.

---

# 16. DESIGN SYSTEM AND VISUAL DIRECTION

Create a premium, modern, developer-focused interface.

## Visual Direction

- Dark-first editor experience.
- Clean typography and strong visual hierarchy.
- Consistent spacing and alignment.
- Subtle borders and restrained shadows.
- Professional code editor aesthetics.
- Accessible color contrast.
- Minimal visual clutter.
- Smooth and purposeful UI transitions.

Use Tailwind CSS and a consistent design token system.

Support light and dark themes where practical.

The editor should feel like a modern developer tool combined with a professional motion-design studio.

Avoid excessive gradients, unnecessary glass effects, distracting animations, and oversized decorative elements.

## Branding

Use the product name MotioCode consistently throughout the application.

Use the tagline:

"Bring Your Code and Ideas to Life."

Keep branding assets, colors, and typography configurable through a shared design system.

---

# 17. APPLICATION ARCHITECTURE

Create a modular architecture that separates:

- Application shell and routing.
- Authentication and user management.
- Dashboard and project management.
- Editor interface.
- Canvas and visual elements.
- Scene and timeline management.
- Animation engine.
- Code editor.
- Diagram editor.
- Infographic editor.
- Remotion composition rendering.
- Export job orchestration.
- Database and storage access.

Keep the project model independent of the UI framework wherever practical.

Define reusable TypeScript types and validation schemas for:

- Projects.
- Scenes.
- Visual elements.
- Animations.
- Diagram definitions.
- Export settings.

Avoid tightly coupling code editing, diagram editing, and infographic editing to one another.

Use shared interfaces and reusable rendering components where appropriate.

---

# 18. SECURITY AND RELIABILITY

Implement:

- Supabase Row Level Security.
- Server-side validation.
- Secure authentication handling.
- Authorization checks for project access.
- Asset ownership verification.
- File type and size validation.
- Secure export job authorization.
- Error boundaries.
- Meaningful error messages.
- Safe handling of user-provided diagram definitions and configuration.
- Protection against unauthorized access to private media.

Never expose Supabase service-role credentials in client-side code.

Treat user-created content as untrusted input and validate it before rendering.

---

# 19. PERFORMANCE AND ACCESSIBILITY

Optimize for:

- Smooth canvas interactions.
- Efficient timeline updates.
- Responsive project loading.
- Efficient scene switching.
- Memory-conscious preview rendering.
- Large diagram editing.
- Efficient asset loading.
- Predictable editor state updates.

Use React memoization and state partitioning where profiling indicates a need.

Support:

- Keyboard navigation.
- Accessible labels.
- Visible focus states.
- Appropriate color contrast.
- Reduced-motion preferences in the application interface.

Do not compromise the accuracy of the animation timeline for performance shortcuts.

---

# 20. TESTING REQUIREMENTS

Use automated tests for critical application workflows.

## Unit Tests

- Project and scene models.
- Animation timing.
- Timeline calculations.
- Configuration validation.
- Diagram transformations.

## Component Tests

- Editor controls.
- Canvas interactions.
- Properties panel.
- Scene manager.
- Timeline controls.
- Code editor integration.

## Integration Tests

- Supabase project persistence.
- Authentication and authorization.
- Project ownership and RLS.
- Export job state transitions.
- Asset management.

## End-to-End Tests

Validate the following workflow:

1. User signs up or logs in.
2. User creates a project.
3. User adds content.
4. User edits a scene.
5. User previews the animation.
6. User saves the project.
7. User reopens the project.
8. User exports a video where supported.

Validate that the preview and rendered output remain consistent for the same project and timeline.

---

# 21. IMPLEMENTATION PHASES

Implement the MVP incrementally.

## Phase 1 — Foundation

Deliverables:

- Next.js and TypeScript setup.
- Tailwind CSS configuration.
- Supabase integration.
- Authentication.
- Application shell.
- Dashboard.
- Initial database schema.
- Project creation.
- Project saving and loading.
- Basic editor layout.

## Phase 2 — Core Editor

Deliverables:

- Canvas.
- Element selection and manipulation.
- Basic text, shapes, and code elements.
- Scene manager.
- Properties panel.
- Basic timeline.
- Playback controls.
- Project persistence.
- Initial configuration editor.

## Phase 3 — Core Content Modules

Deliverables:

- Animated code snippets.
- Basic architecture diagrams.
- Basic flowcharts.
- Text-based diagram definitions.
- Simple animated infographic elements.
- Shared animation presets.
- Starter templates.

## Phase 4 — Preview and Export

Deliverables:

- Shared project-to-animation mapping.
- Browser-based preview.
- Timeline playback and seeking.
- Remotion composition integration.
- Export prototype.
- Output format settings.
- Download workflow where supported.

## Phase 5 — MVP Polish

Deliverables:

- Project duplication.
- Export history.
- Improved editor usability.
- Responsive dashboard.
- Accessibility improvements.
- Error handling.
- Performance optimization.
- Security review.
- Deployment and monitoring setup.
- End-to-end testing.

Do not move to the next phase until the current phase has a working, testable result.

---

# 22. FUTURE ENHANCEMENTS — NOT PART OF THE INITIAL MVP

The following features are future product opportunities.

Do not implement these features during the initial MVP unless explicitly requested.

## AI-Assisted Content Creation

- Natural-language-to-diagram generation.
- AI-generated scene sequences.
- AI-assisted code explanations.
- AI-assisted infographic creation.
- Automatic animation suggestions.
- Automatic technical storytelling outlines.

## Advanced Animation Capabilities

- Advanced keyframe animation.
- Custom easing curves.
- Complex motion paths.
- Advanced camera movements.
- Layer grouping and nesting.
- Reusable custom animation presets.
- More sophisticated timeline editing.

## Advanced Technical Diagram Support

- Full UML diagram coverage.
- Advanced sequence diagrams.
- Class and component diagrams.
- Infrastructure-specific icon libraries.
- Automatic layout algorithms.
- Import and export integrations for additional diagram formats.

## Advanced Rendering Infrastructure

- Dedicated server-side rendering service.
- Distributed rendering workers.
- Render queues.
- Render retries and monitoring.
- Usage-based rendering limits.
- High-resolution export.
- Advanced video encoding settings.

## Collaboration and Sharing

- Public shareable project links.
- Read-only project previews.
- Collaborative editing.
- Team workspaces.
- Shared asset libraries.
- Comments and review workflows.

## SaaS Monetization

- Subscription plans.
- Usage limits.
- Paid export features.
- Team subscriptions.
- Billing and payment integrations.
- Usage analytics and account-level quotas.

## Content Distribution

- Brand kits.
- Reusable social media presets.
- Additional platform-specific export presets.
- Template marketplace.
- Community templates.
- Public content discovery.

Implement these enhancements only after validating the core MVP workflow.

---

# 23. DEVELOPMENT WORKFLOW

Before writing implementation code:

1. Review the product requirements.
2. Identify missing decisions and assumptions.
3. Propose a practical MVP architecture.
4. Define the initial database schema.
5. Define the shared project, scene, and animation data model.
6. Define the editor layout and primary user flows.
7. Identify the main technical risks, especially timeline synchronization and video rendering.
8. Break the implementation into small, testable milestones.

Then implement the application incrementally.

For each milestone:

- Explain the goal.
- Identify the files and modules to create or update.
- Implement the feature.
- Run relevant tests and type checks.
- Fix discovered issues.
- Summarize what is complete and what remains.

Do not generate a large, unstructured codebase in one step.

Do not add speculative features without a clear product need.

When a technical decision has meaningful trade-offs, explain the alternatives and recommend a practical MVP approach.

---

# 24. MVP DEFINITION OF DONE

The MVP is considered complete when an authenticated user can:

1. Create a MotioCode project.
2. Choose a starter template or start from a blank project.
3. Create and edit scenes.
4. Add animated code, diagrams, and infographic elements.
5. Use visual editing and supported code/configuration editing.
6. Configure basic animation timing.
7. Preview the animation.
8. Save and reopen the project.
9. Export a playable video through the supported export workflow.
10. Download the finished output and share it on a social media platform.

The MVP should demonstrate a reliable end-to-end workflow for creating professional technical visual content.

---

# 25. FIRST TASK — BEGIN IMPLEMENTATION

Start by preparing the following:

1. MVP architecture proposal.
2. Recommended project folder structure.
3. Initial database schema and RLS strategy.
4. Shared project, scene, element, and animation data model.
5. Editor wireframe and component breakdown.
6. Phase 1 implementation plan.
7. Initial technical risks and mitigation strategies.

After presenting these, begin implementing Phase 1.

Keep all implementation decisions aligned with the MotioCode product vision and the MVP scope defined in this prompt.

Do not implement future-phase features prematurely.
