# Product Safety Experience Tasks

- [x] Task: Add pack metadata and catalog presentation.
  - Acceptance: named packs plus one per remaining flow exist; commands copy above catalog.
  - Verify: `npm test`, `npm run registry:build`.
  - Files: `registry/default/*-pack`, registry generator/catalog, landing catalog components, tests.

- [x] Task: Add shared prompt-copy and accent controls.
  - Acceptance: all preview panels expose the prompt action; four accessible accents persist locally.
  - Verify: `npm run typecheck`, browser keyboard check.
  - Files: preview/theme components, global CSS, tests.

- [x] Task: Build landing evidence and comparison sections.
  - Acceptance: fictional prevention scenarios and manually selected Before/After transfer are rendered with no autoplay.
  - Verify: `npm test`, browser visual check at 320/768/1024/1440 px.
  - Files: landing components, landing page, tests.

- [x] Task: Build the Break this form playground.
  - Acceptance: three mock forms, six chaos triggers, real catching components/logic, live counter, reduced-motion-safe UI.
  - Verify: `npm test`, `npm run typecheck`, browser keyboard check.
  - Files: playground route/components, tests.

- [x] Task: Add agent taxonomy and navigation discovery.
  - Acceptance: Agent / Human-in-the-loop category, nav badge, and agent pack membership are discoverable without displacing core message.
  - Verify: `npm test`, `npm run registry:build`.
  - Files: metadata/catalog/navigation/landing components, tests.

- [x] Task: Run final quality gates and inspect output.
  - Acceptance: all requested commands succeed and no external claims are left unverified.
  - Verify: `npm test`, `npm run lint`, `npm run typecheck`, `npm run registry:build`.
  - Files: all modified files.
