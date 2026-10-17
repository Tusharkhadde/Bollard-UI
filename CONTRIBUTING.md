# Contributing to Bollard UI

Thanks for helping make interfaces harder to get wrong. Bollard UI is a collection of copy-paste React components, each built to stop one specific, costly user mistake. This guide covers how to report problems, propose components and send pull requests.

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug** in a component or the docs site with the [bug report form](https://github.com/Tusharkhadde/Bollard-UI/issues/new?template=bug_report.yml).
- **Propose a component** with the [component request form](https://github.com/Tusharkhadde/Bollard-UI/issues/new?template=component_request.yml). Tell us the mistake it stops and who makes it.
- **Improve an existing component**: edge cases, accessibility, wording, mobile layout, performance.
- **Improve the docs**: clearer usage examples, better search tags, typo fixes.

Security problems go through [SECURITY.md](SECURITY.md), never a public issue.

## The bar for a component

Every component must:

1. **Stop a real, specific mistake.** "An extra zero on a payment", not "a nicer input". Name the mistake in one line.
2. **Be original.** Not a restyle of something shadcn/ui, Magic UI, Aceternity, Origin UI or another library already ships. It needs a twist that makes it the best version of its pattern.
3. **Be accessible.** Real labels, full keyboard support, `aria-live` for warnings that appear while typing, works with a screen reader, honours `prefers-reduced-motion`.
4. **Be SSR-safe and typed.** No `window`/`document`/`localStorage` at module scope or during render. Strict TypeScript with JSDoc on props.
5. **Stay lean.** React, `lucide-react` and the approved packages in [docs/AUTHORING.md](docs/AUTHORING.md). No UI kits with their own design system.
6. **Use the shadcn theme tokens**, so it drops into any shadcn project and looks right in light and dark mode.

Open an issue before starting a new component so we can agree on the idea and the name. Small fixes can go straight to a pull request.

## Development setup

You need Node.js 20 or newer (22 recommended, see `.nvmrc`) and npm.

```bash
git clone https://github.com/Tusharkhadde/Bollard-UI.git
cd Bollard-UI
npm install
npm run dev            # docs site with live demos at http://localhost:3000
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the docs site locally |
| `npm run generate` | Rebuilds `registry.json` and `components/demo-index.tsx` from `registry/default/*/meta.json` |
| `npm run typecheck` | TypeScript check for the whole repo |
| `npm run registry:build` | `generate` plus `shadcn build`, which writes `public/r/*.json` |
| `npm run build` | Production build of the docs site |

## Adding a component

Read [docs/AUTHORING.md](docs/AUTHORING.md) first. It has the full rules and API conventions. In short, a component `<name>` (kebab-case) is three files:

```
registry/default/<name>/<name>.tsx   the component (named exports only)
registry/default/<name>/meta.json    title, description, dependencies and search tags
components/demos/<name>.tsx          a deterministic demo that opens showing the mistake being caught
```

`meta.json` needs `title`, `description` (one sentence: the mistake and how it's stopped), `dependencies`, and the search tags `stops`, `mistakes`, `aliases`, `flows` and `fields`. Copy an existing component's `meta.json` (for example `registry/default/amount-input/meta.json`) and adapt it.

Then:

1. Add the name to the right category in `CATEGORIES` in `scripts/generate.mjs`.
2. Run `npm run generate`.
3. Run `npm run typecheck`.
4. Check the demo at `http://localhost:3000/preview/<name>` and `?theme=dark`, and at a 375px-wide window.
5. Optionally run `npm run registry:build` and install your component into a fresh shadcn app from `public/r/<name>.json`.

Grep the existing `meta.json` descriptions before picking a name, to make sure the idea isn't already covered.

## Pull requests

- Branch from `main` and keep each pull request to one component or one focused change.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and the PR title, for example `feat(amount-input): flag a missing zero`, `fix(site): sidebar scroll on load`, `docs: clarify install steps`.
- Commit the regenerated `registry.json` and `components/demo-index.tsx` when you add or rename a component. Don't commit `public/r/*.json` by hand edits; regenerate them.
- Fill in the pull request template, including screenshots for any visual change (light, dark and mobile).
- CI must pass: generated files up to date, typecheck, registry build and site build.
- Be ready for review comments. We review every component as an end user, as a developer reading the API, and against the best alternative on the market.

## Style

- Follow the API conventions in [docs/AUTHORING.md](docs/AUTHORING.md): `data-slot`, `className` plus `...props`, controlled and uncontrolled `value`/`defaultValue`/`onValueChange`, every user-visible string a prop.
- Pure logic (parsers, detectors, formatters) is exported as plain functions so it can run on the server.
- Use the 4px spacing scale and the shared input and button sizes.
- Keep components roughly 80 to 250 lines. Split helpers into a second file in the same folder only when it truly helps.

## Licence

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
