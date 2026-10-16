# Changelog

All notable changes to Bollard UI are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Components are copied into your project, so each entry names the components it touches; re-run `npx shadcn@latest add <url>` to pick up a change.

## [Unreleased]

### Added
- Docs pages: Getting started, Start here, Quality, Security, License and Changelog.
- Every component page now has a short summary, What it catches, a Props table, Accessibility notes, Limitations, a server-side note for security-adjacent components, and a Rules box with the date and sources for rule-bearing ones.
- Per-component social images and canonical URLs.

### Changed
- Wording on security-adjacent components now says what the UI surfaces and what the server must still enforce.
- Categories: "Inputs that catch typos" split into Validators, Readbacks and calculators, and Parsers and analyzers; non-destructive items moved to Submits and rate limits.
- Registry homepage points to the docs site; displayed imports use `@/components/ui/...`.
- Open-source project files: contributing guide, code of conduct, security policy, issue and pull request templates, CI and Dependabot.

## [0.1.0] - 2026-10-16

### Added
- 340 components that stop users from making mistakes, across destructive actions, inputs that catch typos, payments, sign-up and security, messaging, developer tools and scheduling.
- shadcn CLI registry at `https://bollard-ui.vercel.app/r/<name>.json`.
- Docs site with live demos, ranked search by mistake, flows, ⌘K palette, and per-component install, usage and "What it stops" sections.

[Unreleased]: https://github.com/Tusharkhadde/Bollard-UI/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Tusharkhadde/Bollard-UI/releases/tag/v0.1.0
