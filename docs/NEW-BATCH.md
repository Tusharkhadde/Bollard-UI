# Brief for new components

You are adding brand-new components to Bollard UI, a library of "components that stop users from making mistakes". Tushar's bar: each one is unique (not a copy of shadcn, Magic UI, Aceternity or any existing library), the best version of its pattern, clean, and researched.

For each component you own:
1. Research first (web_search): how real products handle this mistake, known failure cases, the standards involved (e.g. IBAN mod-97, cron syntax). Find the clever detail that makes yours better than a plain version.
2. Read docs/AUTHORING.md and follow every rule and API convention. Look at 2–3 existing components (email-input, conflict-banner, two-step-button, text-diff) and match their visual family exactly: field and button sizes, amber warning line with one-tap fix button, banner tones.
3. Write registry/default/<name>/<name>.tsx (+ an extra .ts helper in the same folder only if it truly helps), meta.json (title, description: one sentence on the mistake it catches and how; dependencies), and components/demos/<name>.tsx exporting `Demo`, which opens already showing the mistake being caught and fits a 375px card.
4. Test in a real browser with scripts/static-preview.mjs (NOT next dev) on your port, check.mjs in light, dark and WIDTH=375, and a Playwright interaction script in .checks/ that exercises the catch and asserts it. Look at every screenshot and fix what looks off.
5. `npx tsc --noEmit --incremental false -p .` must pass for your files.

Don't touch registry.json, components/demo-index.tsx, app/, scripts/, or other components. Don't push. Report per component: the twist, what you tested, and anything left open.

## Motion (batch 2+)
Animation is welcome when it helps the user notice or understand the catch (a draining timer, a value flashing when it changed, a cover lifting off a switch, a row springing back). Keep it purposeful and short (150–400ms, ease-out), no decorative loops. Allowed: Tailwind transitions, `animate-spin`/`animate-pulse`, Tailwind arbitrary `animate-[name_300ms_ease-out]` with the keyframes in a small `<style>` tag rendered by the component (prefix keyframe names with `cui-<component>-` to avoid clashes), Web Animations API (`el.animate`). Still no tw-animate-css and no animation libraries. Always honour `prefers-reduced-motion` (`motion-safe:`/`motion-reduce:` or a matchMedia check) so the component still works and reads correctly with no motion. Test the animated states with a screenshot mid-animation.
