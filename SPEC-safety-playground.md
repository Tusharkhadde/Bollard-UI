# Spec: Safety Playground

## Objective

Create `/playground` with Transfer Money, Delete Workspace, and Sign Up forms whose chaos controls trigger existing safety components and update a visible caught-mistakes count.

## Commands

`npm test`, `npm run lint`, `npm run typecheck`, `npm run registry:build`.

## Project Structure

`app/(site)/playground/page.tsx` hosts the page; focused client components live under `components/site/playground/`.

## Code Style

```tsx
<output aria-live="polite">{caught} mistakes caught</output>
```

Use local state, semantic forms, and reduced-motion-safe effects.

## Testing Strategy

Add static assertions for each chaos control and the counter; browser test keyboard execution of each button.

## Boundaries

- Always: use real Bollard registry components or their logic, not simulated alert copy.
- Ask first: new third-party packages.
- Never: embed a valid API key; use a clearly fake, redacted string.

## Success Criteria

- Six named chaos actions are available and caught visibly.
- The page is responsive, keyboard operable, and contains no autoplay animation.

## Open Questions

None.
