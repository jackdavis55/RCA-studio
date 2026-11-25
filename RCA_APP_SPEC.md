# RCA Studio — implementation specification for Codex

## 1. Objective and delivery instructions

Build a fully functional, desktop-first Root Cause Analysis (RCA) investigation application in React and Next.js. Implement the application, not merely a mockup. Use the fictional fixtures below to demonstrate every initiation category and visualisation. All views must share one canonical investigation model. Work incrementally, run lint, type checking, tests and production build, and document how to start the app. Inspect any existing repository before scaffolding; preserve unrelated files. If starting from an empty repository, initialise Next.js App Router with TypeScript, Tailwind CSS and ESLint. Use compatible stable package versions and commit a lockfile. Do not require credentials, paid services or network access at runtime.

## 2. Scope and architecture

- Next.js App Router, React, strict TypeScript, Tailwind CSS, shadcn/ui or equivalent accessible primitives, Lucide React icons.
- `@xyflow/react` for graph canvases; `elkjs` for layered graph layouts; `d3-scale` for time positioning; Zustand for shared state; Zod for runtime JSON validation.
- No sign-in, user accounts, database, server actions, API routes, telemetry or remote assets. Use client components for interactive canvases and browser storage. Static export (`output: 'export'`) should work.
- Bundle `src/data/cases.json` as read-only seed data. Initialise client state from it; persist edited copies in versioned localStorage. Never imply that a browser can rewrite the bundled source JSON. Export edited cases as downloadable JSON; import via file picker with validation and explicit replace/merge choice. Reset to seed with confirmation. Handle unavailable storage, quota errors and invalid imports without losing current state.
- Suggested structure:

```text
src/app/page.tsx
src/app/layout.tsx
src/app/globals.css
src/components/shell/
src/components/views/{Overview,Timeline,Swimlane,CausalMap,BowTie,FaultTree,Findings}.tsx
src/components/graph/{EventNode,BarrierNode,GateNode,CausalEdge,TimeRuler}.tsx
src/components/inspector/
src/lib/{schema,layout,selectors,validation,export}.ts
src/store/investigation.ts
src/data/cases.json
 tests/
```

## 3. Visual design system

Match the reference concept: professional industrial investigation dashboard, navy navigation, pale grey canvas, white cards, subtle borders, compact typography and restrained shadows. Use a system sans-serif or locally bundled font. Light mode default; optional dark mode with accessible contrast. No gradients except subtle duration shading; no decorative stock photography.

| Token | Hex | Meaning / icon |
|---|---|---|
| Navy | #172238 | Sidebar |
| Canvas | #F5F7FA | Workspace |
| Surface | #FFFFFF | Cards |
| Border | #DCE2EA | Dividers |
| Text | #172033 | Primary text |
| Muted | #64748B | Secondary text |
| Primary | #2563EB | Selection and controls |
| Procedural | #A855F7 | ClipboardList |
| Equipment | #EF4444 | Settings |
| Environmental | #0D9488 | CloudLightning |
| Human | #D97706 | Users |
| External | #2563EB | Network |
| Organisational | #64748B | Building2 |
| Software | #0891B2 | Monitor |
| Design | #DB2777 | ShieldAlert |
| Normal / effective | #16A34A | CheckCircle |
| Process upset | #D97706 | AlertTriangle |
| Top event / failed | #EF4444 | OctagonAlert |
| Consequence | #64748B | Activity |

Use category colour as a left border, icon and pale tinted background (8–12% opacity). Keep body text dark and readable; never rely on colour alone. Status labels: Unassessed, Hypothesis, Supported, Confirmed, Ruled out. Confirmed links solid; supported links solid with explicit label; hypothesis/unassessed dashed; ruled-out links hidden by default and shown muted with an X when enabled. Temporal adjacency is a neutral line without causal arrowheads. Barrier statuses: effective (green), degraded (amber), failed (red), missing (red outline), unknown (grey). Distinguish category, severity, and evidence status.

## 4. Application shell

Desktop: 220px collapsible navy sidebar; flexible centre workspace; 320px collapsible right inspector. Header: RCA Studio, case selector, case ID, title, fictional-data label, import/export, reset, theme toggle. Sidebar: Overview, Events & Timeline, Cause Analysis, Barriers, Findings & Actions. Workspace tabs: Linear Timeline, Swimlanes, Causal Map, Bow-tie, Fault Tree. Preserve case, selection and filters across tabs. Left node palette available in graph editing mode. On narrow screens use drawers and horizontally scrollable canvases; never shrink diagrams until unreadable. Include empty states, loading states, keyboard focus and accessible labels.

## 5. Required visualisations

### 5.1 Overview / multi-infeed dashboard

Display eight initiating-trigger cards with icon, category, assessment status, event count and click-to-filter. Display central event sequence with timestamps, normal operation, deviations, process upset, top event and consequences. Below, show aligned trigger swimlanes and a selected-event inspector with evidence and mini causal summary. Show ruled-out and unassessed categories distinctly; absence of evidence is not proof of exclusion.

### 5.2 Linear timeline

Chronological axis with actual proportional time positions, tick labels, zoom, pan, fit, date/time range filter, and event cards. Render duration bands for interval events, approximate time labels, and a separate undated tray. Use collision-aware vertical stacking or callouts without moving the true timestamp anchor. Allow long time spans and an explicit focus window for latent conditions. Mark top event with a vertical red line. Chronological order must not create causal edges automatically.

### 5.3 Multi-lane timeline

Rows for procedural, equipment, environmental, human, external, organisational, software, design, process and consequences. Sticky lane labels and ruler; collapsible empty lanes; optional grouping by asset or source. Render cross-lane causal edges from the actual relationship records. Show parallel events, convergence, duration and uncertain time ranges. Dragging must not silently change event timestamps; use explicit edit controls. Provide playback slider and play/pause/reset, revealing events up to the selected time; undated events remain in their own tray.

### 5.4 Causal map

React Flow canvas with custom event, condition, barrier, consequence and AND/OR gate nodes. Left-to-right ELK layout, multiple handles, smoothstep edges, minimap, controls, fit view, zoom/pan, drag-to-reposition, auto-layout and selection. Multiple independent infeeds may converge at any intermediate event, not only the top event. Allow downstream branching. Add/edit/delete nodes and links; validate self-links, duplicates, dangling references and causal cycles (warn and reject cycles in MVP). Link inspector shows relationship type, status, rationale and evidence. Preserve manual positions per case/view; reset layout explicitly. Highlight upstream/downstream paths of selection. Provide hypothesis and ruled-out filters.

### 5.5 Bow-tie

Threats on left, preventive barriers between threats and top event, mitigative barriers between top event and consequences on right. Show separate pathways, barrier status, evidence and owner. Distinguish occurred, potential and prevented consequences. Use explicit bow-tie pathway records rather than inventing barriers from graph proximity. Clicking a barrier opens its inspector. Do not label a barrier effective simply because a consequence did not occur.

### 5.6 Fault tree

Top event at top, intermediate failures and basic events below, explicit AND/OR gates. Use a top-down layout. AND means all inputs required; OR means any input sufficient in the specified model. Do not infer logic from multiple incoming edges. Render undeveloped events and hypotheses distinctly. No probability calculations unless valid probability data and assumptions are supplied; MVP is qualitative. Show a clear empty state when no tree has been defined.

### 5.7 Findings and actions

Table of findings, evidence, causal factor, confidence, corrective action, owner, due date and status. Allow creation/editing and filtering. Link actions to specific events, relationships or barriers. Show overdue based on local date, with no external notifications. Provide case summary and printable report using print CSS.

## 6. Shared interaction and validation

- Inspector tabs: Details, Evidence, Causal links, Barriers, Actions. Editable fields with save/cancel; evidence metadata includes source, observation, timestamp and reliability note. Seed evidence is fictional text, not real attachments.
- Add events via palette or form; assign category, role, timestamp or range, status and evidence. Add causal links through handles or accessible form. Explicit confirmation for destructive changes; cascade references only after showing affected items, or block deletion until references are removed.
- Search titles, descriptions, evidence; filters for category, status, role, date range and case. Selected hidden items must clear or display a clear hidden-selection notice. Filters must not mutate underlying data.
- Undo/redo for edits within current session; bounded history. Autosave indicator reflects actual storage result. Case switching preserves edits.
- Validate ISO 8601 timestamps with offsets, range ordering, unique IDs, referential integrity, gate arity (at least two inputs), tree cycles, pathway barrier roles and action targets. Flag causal links whose known times contradict direction; allow documented exceptions for overlapping/uncertain times. Keep evidence status separate from event occurrence and causal confidence.
- Export case JSON and full collection JSON; graph PNG/SVG export optional if reliable; print report required. No external upload. Treat imported text as plain text; never render arbitrary HTML.

## 7. Canonical data contract

Use schemaVersion 1. IDs are stable strings unique within a case; all references resolve within that case. Implement Zod schemas and infer TypeScript types. Define these records (optional fields may be omitted):

```ts
type Category = 'procedural'|'equipment'|'environmental'|'human'|'external'|'organisational'|'software'|'design'|'process'|'consequence';
type Status = 'unassessed'|'hypothesis'|'supported'|'confirmed'|'ruled-out';
type Event = {id:string; title:string; description:string; category:Category; role:'trigger'|'condition'|'event'|'top-event'|'consequence'; time:string|null; endTime?:string; timePrecision:'exact'|'approximate'|'range'|'unknown'; status:Status; occurrence:'observed'|'possible'|'prevented'|'not-observed'|'unknown'; evidenceIds:string[]; asset?:string};
type Link = {id:string; source:string; target:string; type:'causes'|'contributes'|'enables'|'prevents'|'mitigates'; status:Status; rationale:string; evidenceIds:string[]};
type Evidence = {id:string; title:string; source:string; observation:string; time:string|null; reliability:string};
type Barrier = {id:string; title:string; role:'preventive'|'mitigative'; status:'effective'|'degraded'|'failed'|'missing'|'unknown'; owner:string; evidenceIds:string[]};
type Pathway = {id:string; threatId?:string; consequenceId?:string; barrierIds:string[]; side:'left'|'right'};
type Gate = {id:string; operator:'AND'|'OR'; inputIds:string[]; outputId:string; status:Status; rationale:string};
type Action = {id:string; title:string; targetType:'event'|'link'|'barrier'; targetId:string; owner:string; dueDate:string|null; status:'open'|'in-progress'|'complete'; rationale:string};
type Case = {id:string; title:string; description:string; fictional:true; timezone:string; topEventId:string; events:Event[]; links:Link[]; evidence:Evidence[]; barriers:Barrier[]; pathways:Pathway[]; gates:Gate[]; actions:Action[]; categoryAssessments:Partial<Record<Category,Status>>};
type CaseFile = {schemaVersion:1; cases:Case[]};
```

Use UTC internally and case timezone for display. Keep layout coordinates and UI preferences in a separate local state object, not in evidence records. A gate output may be an event; gate inputs may be events or other gates. Validate all references and render gate-to-gate dependencies without duplicate nodes. A category assessment is an investigator judgement, not automatically a root cause.

## 8. Fictional seed cases

Copy the companion `cases.json` into `src/data/cases.json`. It contains eight fictional investigations, one per initiating category, with converging factors, chronological sequences, evidence, alternative hypotheses, barriers, qualitative gates and actions. The first case is the main demonstration of the multi-infeed dashboard. Treat all records as synthetic examples, not actual incident findings. Do not silently upgrade hypotheses into confirmed causes. Use the fixture as the canonical starting data; extend it only with internally consistent fictional records if needed to demonstrate a feature.

## 9. Acceptance criteria and test plan

- Fresh install: `npm install`, `npm run dev` opens app without login, environment secrets or database. `npm run build` succeeds with static export. Document commands in README.
- All eight cases load; every view renders from the same JSON. Switching cases and views updates selection and data without stale nodes.
- First case shows multiple converging infeeds, ruled-out environmental hypothesis, an undated condition, a range event, an AND gate, a downstream branch and failed/effective barriers.
- All category colours and status semantics match the design system; keyboard navigation and readable contrast; test at 1440, 1024 and 390px widths.
- Editing a node updates all views; reload restores local edits; reset restores seed; export/import round-trip retains IDs and content. Invalid JSON, dangling references, duplicate IDs and unsupported schema versions are rejected with useful errors.
- Verify time scaling, collision handling, unknown time tray, playback, edge filters, gate layout, pathway layout, undo/redo and deletion safety.
- Unit tests for schema, selectors, time positioning and graph validation; integration tests for persistence and import/export; browser smoke tests for case switching, node edit, filtering and all views. Use Vitest and Playwright or existing equivalent tooling.
- No placeholder buttons, console errors, hydration warnings or unhandled promise rejections. Clearly label optional unimplemented features rather than fake functionality.

## 10. Implementation order

1. Scaffold, schema, fixture validation, state and persistence.
2. Shell, overview, inspector and shared design tokens.
3. Linear timeline and swimlanes, including time uncertainty and playback.
4. Causal map, editing and ELK layout.
5. Bow-tie and fault tree, findings/actions.
6. Import/export, print, accessibility, responsive polish and tests.

At completion, report files changed, commands run, test/build results, known limitations and any deviations from this specification. Do not claim tests passed unless executed.
