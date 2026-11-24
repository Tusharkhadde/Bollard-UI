# Spec: Preview Controls

## Objective

Add a copyable v0/Cursor prompt on preview panels and a persistent accent switcher with Amber, Indigo, Emerald, and Rose options.

## Commands

`npm test`, `npm run lint`, `npm run typecheck`, `npm run registry:build`.

## Project Structure

`components/site/preview-panel.tsx` receives the prompt action; theme client code and global CSS hold accent state and tokens.

## Code Style

```tsx
<button aria-pressed={accent === value}>Amber</button>
```

Use an accessible radio-like control group and CSS custom properties; persist a non-sensitive preference locally.

## Testing Strategy

Assert all four choices and preview prompt control; browser verification covers keyboard navigation and persistence.

## Boundaries

- Always: use no new runtime dependency and honor reduced motion.
- Ask first: altering the global dark/light theme behavior.
- Never: include credentials in generated prompts.


## Success Criteria

- Every preview panel has a working “Copy prompt for v0/Cursor” control.
- Users can select one of four distinct accents with keyboard-accessible controls.

## Open Questions

None.
