# RCA Studio

RCA Studio is a desktop-first investigation workspace with eight fictional cases. It runs locally and can also be served as a static site. Case data, edits and graph positions stay in the current browser origin.

## Install and start

Use Node.js 22.12 or later and npm.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production preview, run `npm run build` followed by `npm start`. The static export is in `out/` and can be served by any static file host. The app uses no credentials, remote assets or backend services.

## Working with a case

Open **RCA-001 · Plant feed interruption**, then choose **Open full timeline** from Overview. This example includes dated events for all ten timeline categories, including normal operation, process upset, the top event and consequences. Four supplemental fictional records live in `src/data/plant-feed-timeline.json`. Existing unedited copies of RCA-001 pick up the additions on reload. For edited copies, export your work before using **Reset to seed** to see the expanded example.

- Select an investigation and navigate through Overview, Linear Timeline, Swimlanes, Causal Map, Bow-tie, Fault Tree and Findings & Actions. Search includes linked evidence text. Date filters use the device’s local time and the visualisations display the case time zone.
- Select a record to open its inspector. Use **Edit graph** to open the node palette or connect event handles. Add a timing exception with the reason when a relationship needs to be recorded despite uncertain ordering. Referenced records must be disconnected before deletion.
- Use the swimlane playback controls to reveal dated events by time. The undated tray remains available. The fault tree uses explicit gates and recorded relationships for its qualitative branches.
- Use **Export** to download one case or the full collection. **Import** validates schema version 1 before applying changes. Merge retains other cases and replaces matching cases by ID. Replace swaps the full collection. **Reset to seed** restores the fictional fixtures. The browser cannot write changes back to the bundled JSON.
- Use **Print report** in Findings & Actions to print or save the full case report as PDF. Graph image export is optional and is omitted.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite serves the static export and exercises the workspace at 1440px, 1024px and 390px. Vitest covers the seed, validation, selectors, layout, persistence and JSON round-tripping.

The canonical bundle is `src/data/cases.json`, copied unchanged from the supplied `cases.json`. `src/lib` holds the model, validation and layout helpers, `src/store` owns browser state and history, and `src/components` holds the shell, inspector and investigation views.
