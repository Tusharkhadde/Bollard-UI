# Changelog

All notable changes to Bollard UI are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Components are copied into your project, so each entry names the components it touches; re-run `npx shadcn@latest add <url>` to pick up a change.

## [Unreleased]

### Added
- Docs pages: Getting started, Start here, Quality, Security, License and Changelog.
- Every component page now has a short summary, What it catches, a Props table, Accessibility notes, Limitations, a server-side note for security-adjacent components, and a Rules box with the date and sources for rule-bearing ones.
- Per-component social images and canonical URLs.
- A headless `useBollardField` hook for connecting sync/async validation to existing React controls, including server-error recovery and accessible error relationships.
- A homepage integration chooser with copy-ready CLI commands, plus one-click install actions on the live component demos.
- Catalog facets for styled versus headless integrations and extra npm packages; result cards surface package and accessibility guidance before install.
- Unit tests for async validation and catalog filtering, now included in CI.

### Changed
- Homepage messaging distinguishes shadcn-styled components from the UI-library-agnostic hook; search facets remain shareable in the URL and no longer drop active filters when text has no exact match.
- Wording on security-adjacent components now says what the UI surfaces and what the server must still enforce.
- Categories: "Inputs that catch typos" split into Validators, Readbacks and calculators, and Parsers and analyzers; non-destructive items moved to Submits and rate limits.
- Registry homepage points to the docs site; displayed imports use `@/components/ui/...`.
- Open-source project files: contributing guide, code of conduct, security policy, issue and pull request templates, CI and Dependabot.

## [0.1.0] - 2026-10-16

### Added
- 341 registry entries that stop users from making mistakes, across destructive actions, inputs that catch typos, payments, sign-up and security, messaging, developer tools and scheduling.
- shadcn CLI registry at `https://bollard-ui.vercel.app/r/<name>.json`.
- Docs site with live demos, ranked search by mistake, flows, ⌘K palette, and per-component install, usage and "What it stops" sections.

[Unreleased]: https://github.com/Tusharkhadde/Bollard-UI/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Tusharkhadde/Bollard-UI/releases/tag/v0.1.0
