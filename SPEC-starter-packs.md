# Spec: Starter Packs

## Objective

Make one-command registry packs for the core safety flows: fintech, agents, danger-zone, India, plus packs for every remaining catalog flow. Place a copyable install command above the full catalog.

## Tech Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, local shadcn registry.

## Commands

`npm test`, `npm run lint`, `npm run typecheck`, `npm run registry:build`.

## Project Structure

`registry/default/*` contains registry items; `lib/kits.ts` and landing components provide catalog presentation; `tests/*.test.mjs` covers generated artifacts.

## Code Style

```ts
const pack = { name: "fintech-pack", registryDependencies: ["amount-input"] }
```

Use typed, immutable catalog data; keep generated registry source-of-truth in item meta files.

## Testing Strategy

Add static tests that assert pack names, dependencies, and rendered homepage location; run all existing tests plus registry validation/build.

## Boundaries

- Always: preserve existing component props and registry behavior.
- Ask first: runtime dependencies or registry schema changes.
- Never: include private keys or mutate component APIs.

## Success Criteria

- Four named packs and one pack for every remaining flow install related components through `registryDependencies`.
- Homepage exposes copyable pack commands before its catalog.

## Open Questions

None; “remaining flow” means every distinct existing `meta.flows` value not covered by the named packs.
