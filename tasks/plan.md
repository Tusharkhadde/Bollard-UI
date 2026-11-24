# Implementation Plan: Product Safety Experience

## Design Contract

The landing page continues to lead with forms and critical actions. Packs and proof make the value immediately installable and believable; the hero and playground make it tangible. Controls use existing visual tokens, native buttons/inputs, no autoplay, and Tailwind’s responsive layout. Accent selection is a small, client-side preference rather than a dependency or app-wide store.

## Sequence

1. Establish reusable pack metadata and registry entries, then prove registry generation/validation.
2. Build reusable copy/prompt and accent controls so all later previews share them.
3. Add the static prevention proof and hero comparison to the landing composition.
4. Implement the isolated playground using registry component behavior and accessible state announcements.
5. Apply agent category metadata/navigation after pack infrastructure exists.
6. Add static regression tests, run the requested gates, and manually inspect responsive/keyboard behavior.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Generated registry overwrites hand edits | Store pack source in `registry/default/*/meta.json` and use the current generator. |
| Registry pack cannot depend on local items | Use the existing `registryDependencies` format and prove it through `registry:build`. |
| Client/server boundary failures in Next.js | Keep interactivity in focused `"use client"` components. |
| Marketing claims overreach | Use explicitly fictional scenarios and no metrics or real entities. |
| Theme accent reduces contrast | Use existing semantic variables and visibly selected labelled controls. |

## Verification Checkpoints

- After packs: registry build emits every pack and validates dependencies.
- After interactive UI: typecheck catches component/API errors.
- Before handoff: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run registry:build` succeed; inspect keyboard and mobile states.
