# Quality pass brief

Tushar wants the best, cleanest version of every component. You own the components listed in your task. For EACH one, do all of this, and keep iterating until you'd stake your name on it:

1. Read docs/AUTHORING.md (rules, API conventions, visual check). Read the component and its demo critically, as a senior design-systems engineer would review a PR.
2. Test it in a real browser (see "Visual check" in AUTHORING.md): screenshots in light, dark and at WIDTH=375, plus a Playwright interaction script that exercises the core mistake it catches (type, paste, keyboard, click, timing) and asserts the result. Look at every screenshot.
3. Fix everything you find: bugs, edge cases, keyboard or screen-reader gaps, layout shift, overflow, poor contrast, inconsistent sizing or spacing with the conventions, awkward wording, and confusing props. Bring the API in line with the conventions (data-slot, className, ...props, controlled + uncontrolled, string props).
4. Clean the code: simplify, remove dead code and unneeded eslint-disables, clear naming, pure logic exported as functions, short JSDoc. Aim for under ~250 lines; split helpers into a second file in the same folder only if it truly helps.
5. Improve the demo so the mistake is visible at a glance (start in a state that shows the catch), realistic, and fits the card on mobile.
6. Keep the component's core twist. Don't add new dependencies. Don't rename components. Update meta.json's description if the behavior changed.
7. Re-run the browser checks after your fixes, then `npx tsc --noEmit --incremental false -p .` (fix errors in your files; ignore other agents' in-progress files).

Don't edit files you don't own, registry.json, components/demo-index.tsx, app/, or scripts/. Don't push.

Report per component: what you found and fixed (short), and confirm the browser checks and tsc pass. Mention anything you couldn't fix.
