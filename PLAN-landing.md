# Landing redesign plan

## Sections and component tree
`app/(site)/page.tsx` remains the server-rendered SEO entry: Hero (server copy + small client scene player), Trust strip, Playground (lazy client panel), Without/With, Flows, Starter packs, How it works, FAQ, CTA. Preserve server-rendered headline, registry counts, FAQ, install copy and structured data. Shared `Reveal`/`Stagger` and reduced-motion helpers live in `components/site/landing/`; typed event tracking lives in `lib/analytics.ts`.

## Rendering and data
The route page and content sections stay Server Components. Only timed demo/playground/toggle/tab/count-up behavior becomes client components. Catalog count comes from `lib/catalog`; flows and pack count from `lib/kits`/the pack source; GitHub stars are fetched server-side with ISR and static fallback. FAQ text remains `lib/home-faq`. Highlighted install snippet stays server-rendered. Use `motion/react`, already present; do not add confetti unless its package cost proves worthwhile.

## Motion and accessibility
Use Motion for short transform/opacity reveals and the three-scene player. A single timeline state machine handles scene transitions, pause/focus/visibility and cleanup. Respect reduced motion with a caught static scene and explicit Play. Lazy demos reserve fixed-size skeleton space. Keyboard tabs use roving focus and arrow keys; preserve skip link, visible focus, no live announcements for autoplay, and readable static content without JS.

## Content and SEO move
Move the existing About paragraph, facts table, three disaster stories, and existing comparison block to `/about`; retain `/about` metadata, canonical and structured data, and keep homepage software/FAQ JSON-LD intact. Leave homepage guide links and footer guides in place. Do not remove sitemap, robots, llms.txt, OG assets, or internal routes.

## Files
Modify `app/(site)/page.tsx`, `/about` page, landing sections, analytics helper, and global styles only as needed. Add focused landing client components/helpers and this plan. No routes outside `/` and `/about` are in scope.

## Risks
The repository already has extensive landing components and an existing `/playground`; avoid duplicate behavior and preserve existing copy/links. Existing analytics is GA4, while the requested event target says Vercel Analytics; check installed integration and keep tracking best-effort. Motion and React hydration must not prevent server content from painting. Lighthouse, browser screenshots, and bundle comparisons require runnable browser/build tooling.

## Acceptance checklist
- [ ] Homepage sections and interactions match the requested order and content.
- [ ] Counts derive from registry sources; no secrets or typed values reach analytics.
- [ ] About content moved without metadata, JSON-LD, guide links, sitemap or llms.txt loss.
- [ ] Keyboard, reduced-motion, no-JS, narrow-screen and hidden-tab behavior covered.
- [ ] `typecheck`, lint, build and existing tests run; report actual outcomes.
- [ ] Lighthouse and screenshots run when browser tooling is available; report only measured results.
