# Authoring a Bollard UI component

Bollard UI's theme: **components that stop users from making mistakes.** Every component should prevent a real, specific error (lost work, wrong amount, a typo'd email, acting in production, a double charge...). Each one needs a distinctive twist that common libraries (shadcn/ui, Magic UI, Aceternity, Origin UI) don't ship.

Stack: Next.js 16, React 19, Tailwind CSS v4, TypeScript 5. Run `npm install` once from the repo root. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full workflow.

## Files per component `<name>` (kebab-case)
1. `registry/default/<name>/<name>.tsx`: the component. Named exports only, no default export.
2. `registry/default/<name>/meta.json`: `{"title": "...", "description": "one sentence: what mistake it prevents and how", "dependencies": ["lucide-react"]}`. Leave `dependencies` as `[]` when none are needed.
3. `components/demos/<name>.tsx`: `"use client"` file that exports `function Demo()`, a realistic, self-contained, deterministic demo (no Math.random or Date.now during render). Import the component from `@/registry/default/<name>/<name>`.

## Rules
- Imports (opened up 2026-10-14: quality beats zero-deps): `react`, `lucide-react`, `@/lib/utils` (`cn`), other Bollard UI components via `@/registry/default/...` (list them in `registryDependencies`), and these installed packages when they make the component genuinely better:
  - `motion` (import from `motion/react`): spring, layout and exit animations, gestures. Always respect `useReducedMotion()`.
  - `@floating-ui/react`: positioning for popovers, tooltips and suggestion lists (flip, shift, size, autoUpdate).
  - `libphonenumber-js`: phone parsing and validation (use the `min` or `max` metadata entry points deliberately).
  - `date-fns` + `@date-fns/tz`: date maths, parsing and time zones instead of hand-rolled code.
  - `@number-flow/react`: animated number transitions for amounts and counters.
  - Any other well-maintained, MIT/Apache, tree-shakeable package is allowed when it clearly beats hand-rolled code (accuracy, accessibility, edge cases). Install it, note why in your report, and keep bundles lean: no UI kits that bring their own design system (no MUI, Chakra, Mantine, Ant).
  - Every npm package a component imports goes in its meta.json `dependencies`.
- Add `"use client"` when the file uses hooks or events.
- Styling: Tailwind v4 with the shadcn tokens: bg-background, text-foreground, bg-card, bg-popover, bg-muted, text-muted-foreground, bg-accent, border (default color), bg-primary/text-primary-foreground, bg-destructive (text-white on it), ring-ring/50, bg-input. Status colors may use emerald/amber/red with `dark:` variants. Focus style: `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`. Do NOT use tw-animate-css classes (animate-in, fade-in, slide-in-*). Use `motion` for anything beyond a plain transition. Must look good in light and dark.
- Accessibility: real labels, aria attributes, full keyboard support, `aria-live` for warnings that appear while typing, and `role="alert"` only for errors.
- SSR safe: never touch window, document, navigator or localStorage at module scope or during render; use effects.
- Strict TypeScript, typed props with short JSDoc on each prop, and a brief JSDoc on the component explaining the mistake it prevents. Clean, readable code, no dead code. Keep it to roughly 80–250 lines.
- Warnings should be helpful, not blocking, unless blocking is the point. Offer a one-tap fix when possible.
- Study the existing examples for style first: registry/default/hold-to-confirm/hold-to-confirm.tsx, registry/default/inline-edit/inline-edit.tsx, registry/default/secret-field/secret-field.tsx.

## Verify before you finish
Run `npm run generate` and then `npm run typecheck` from the repo root, and fix every error. Commit the regenerated `registry.json` and `components/demo-index.tsx` with your change. In your pull request, give each component's name, a one-line pitch and the mistake it stops.

## API conventions (every component follows these)
- Root element gets `data-slot="<name>"` and accepts `className` (merged with `cn`) plus the rest of the native props of its main element via `...props`, unless that would be misleading.
- Value-holding components support both controlled and uncontrolled use: `value` + `onValueChange(value)` and `defaultValue`. Event-style callbacks are named `onX` (`onConfirm`, `onSave`, `onRetry`). Async callbacks may return a Promise; the component shows a pending state and catches the rejection.
- Inputs: `h-9`, `rounded-md`, `border bg-transparent px-3 text-sm shadow-xs`, `dark:bg-input/30`, `aria-invalid:border-destructive`, and the standard focus ring. Buttons: `h-9 px-4 text-sm font-medium rounded-md` (sm: `h-8 px-3`). Warnings and hints sit directly under the field as `text-xs` or `text-sm`, `mt-1.5`, with an icon at `size-3.5`/`size-4`. Use the 4px spacing scale only (gap-1.5, gap-2, gap-3).
- Pure logic (detectors, parsers, formatters) is exported as plain functions so it can run on the server, and the component calls them.
- React 19: `ref` is a normal prop. No forwardRef.
- Every user-visible string that a product would want to change or translate is a prop with a sensible English default.

## Visual check in a real browser
- Install a browser for Playwright once: `npx playwright install chromium` (or point `CHROMIUM_PATH` at an existing Chrome/Chromium).
- Start the dev server: `npm run dev` (or `npx next dev -p <port>`).
- `/preview/<name>` renders one demo alone (`?theme=dark` for dark mode). `node scripts/check.mjs <port> <name>...` screenshots it in light and dark to `.checks/` and prints runtime errors and overflow. `WIDTH=375` checks mobile. Open the PNGs with read_file and actually look at them.
- For interactions, write small Playwright scripts in `.checks/` (import `chromium` from "playwright", `executablePath: process.env.CHROMIUM_PATH` if you set one): type, paste, press keys, click, and assert the text that should appear. `.checks/` isn't committed.
- On a low-memory machine, use `node scripts/static-preview.mjs <port> <name>...` as a background job instead: same /preview/<name> URLs and frame, much lighter. After editing files, `curl localhost:<port>/__rebuild`, then run check.mjs.
