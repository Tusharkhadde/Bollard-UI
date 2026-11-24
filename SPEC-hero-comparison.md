# Spec: Hero Comparison

## Objective

Show a manually selectable, under-three-second contrast for a transfer amount with and without Bollard.

## Commands

`npm test`, `npm run lint`, `npm run typecheck`, `npm run registry:build`.

## Project Structure

`components/site/landing/hero-preview.tsx` owns the presentation and composes the existing amount input.

## Code Style

```tsx
<button aria-pressed={mode === "with"}>With Bollard</button>
```

Use native controls, explicit labels, and no timed state transitions.

## Testing Strategy

Static behavior assertions plus existing component tests; browser review verifies keyboard toggling.

## Boundaries

- Always: no autoplay loop and no prop changes.
- Ask first: changing AmountInput’s public contract.
- Never: pretend the client check is a server-side payment guarantee.

## Success Criteria

- Without state shows `100,000`, Send, and an obvious fictional failure toast.
- With state flags the extra zero, spells the amount, and requires confirmation.

## Open Questions

None.
