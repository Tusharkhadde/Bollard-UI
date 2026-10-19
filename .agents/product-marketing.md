# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-20

## Product Overview

**One-liner:** Copy-paste React guardrails that stop costly form mistakes and unsafe actions before they happen.

**What it does:** Bollard UI provides 341 React components distributed through a shadcn-compatible registry, plus `useBollardField`, a headless validation hook for existing controls. Components focus on specific human mistakes: duplicate submissions, unsafe deletes, bad input, wrong recipients, accidental sharing and misleading readbacks.

**Product category:** React component registry; form validation and interaction-safety toolkit.

**Product type:** Open-source developer tool; source code is copied into the adopter's app.

**Business model:** MIT licensed. Commercial model and pricing are not defined in the repository.

## Target Audience

**Target companies:** Teams building React 19 applications with shadcn/ui or a compatible Tailwind design system.

**Decision-makers:** Front-end engineers, product engineers, design engineers and technical founders.

**Primary use case:** Add a focused safety layer to a real product flow without rebuilding its UI system.

**Jobs to be done:**

- Prevent ordinary input and confirmation mistakes before a request is sent.
- Add safer defaults to checkout, authentication, account settings and danger-zone flows.
- Keep the source code and adapt it to an existing product rather than adopting a black-box component library.

**Use cases:** Checkout and payments, sign-up and login, account settings, danger-zone actions, forms, messaging, developer tools, scheduling and India-specific inputs.

## Problems & Pain Points

**Core problem:** Existing inputs and generic confirmation dialogs capture data or ask for approval, but they rarely help people notice the specific mistake they are about to make.

**Why alternatives fall short:** A generic form library validates schemas but does not necessarily explain the real-world consequence. Generic dialogs encourage habitual confirmation. Replacing a mature UI system merely to add validation creates adoption friction.

**What it costs them:** Failed sign-ups, duplicate requests or charges, avoidable support work, accidental destructive changes and engineering time spent rebuilding the same edge cases.

## Competitive Landscape

**Direct:** Component registries and shadcn extensions. They often optimize breadth and visual composition rather than mistake-specific interaction design.

**Secondary:** React Hook Form, Zod, Conform and TanStack Form. They provide form state and schemas; Bollard should complement them with task-specific guard rails.

**Indirect:** Home-grown inputs, alert dialogs and one-off validation logic.

## Differentiation

**Key differentiators:**

- Components are named and searchable by the mistake they prevent.
- Every component is copied into the adopter's app through the shadcn registry format.
- `useBollardField` provides a path for existing shadcn, HeroUI and custom controls.
- Components state where server enforcement remains necessary.

**Why customers choose us:** They can improve a risky interaction without surrendering their visual system or hiding business logic inside a package.

## Objections

| Objection | Response |
|---|---|
| “We already use React Hook Form and Zod.” | Keep them. Use Bollard for mistake-specific UI and recovery around the validation you already own. |
| “We cannot replace our existing components.” | Start with the headless hook or copy a component and edit its source in your app. |
| “Client validation is not security.” | Correct. Every relevant component documents the server-side enforcement boundary. |

**Anti-persona:** Teams looking for a fully hosted form backend or an uneditable drop-in component package.

## Customer Language

**How developers describe the problem:**

- “Prevent duplicate form submissions in React”
- “Validate a shadcn email input”
- “Confirm a dangerous delete action”
- “Add validation without changing the UI library”

**Words to use:** guard rail, copy-paste, source you own, existing controls, async-safe, server enforcement, component registry.

**Words to avoid:** platform, seamless, revolutionary, guaranteed safety.

## Brand Voice

**Tone:** Calm, precise and developer-first.

**Style:** Concrete mistakes, clear trade-offs and runnable installation paths.

**Personality:** Practical, candid and detail-oriented.

## Proof Points

**Metrics:** 341 copy-paste components across nine workflow tags, plus one headless hook. Validate this count from the registry before using it in promotional copy.

**Testimonials:** None recorded. Do not invent social proof.

## Goals

**Business goal:** Grow qualified developer adoption of the registry.

**Conversion action:** Copy and run an install command for a relevant component.

**Current metrics:** Google Analytics is configured. Install-command-copy events were added on 2026-10-20; Search Console data has not been connected or reviewed in this repository.

## Changelog

- v1 (2026-10-20) — Initial evidence-backed positioning context drafted from the product, live-site audit and developer-intent research.
