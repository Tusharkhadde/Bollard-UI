# Capability Map: Registry Reliability Release

## Objective

Make every published Bollard registry item predictable for developers and coding agents: configure once, install cleanly, type-check under documented compiler targets, avoid helper-file collisions, and detect regressions before release.

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| registry-onboarding | Publish a local, zero-dependency CLI package for `init` and `doctor`; show a one-command namespace setup and a verification command. | — |
| registry-layout | Audit every generated registry payload; correct helper import paths and file targets so installed files resolve within user-configured aliases. | — |
| compatibility-contract | Remove or declare target-dependent syntax; define supported TypeScript target and component dependency metadata; prevent helper target-name collisions. | registry-layout |
| release-smoke-tests | Create install-style fixtures that validate namespace configuration, generated target paths, TypeScript compilation, and lintability before publishing. | registry-onboarding, registry-layout, compatibility-contract |
| agent-discovery | Keep `llms.txt` and each component’s generated metadata actionable for coding agents, including purpose, dependencies, usage, and enforcement boundaries. | registry-layout, compatibility-contract |

Build order: `registry-onboarding` + `registry-layout` → `compatibility-contract` → `release-smoke-tests` + `agent-discovery`

## Assumptions requiring approval

1. The CLI will be prepared in this repository as a publishable package, but it will **not** be published to npm or change the public package name without a separate release decision.
2. Registry helper outputs will use stable, Bollard-prefixed target filenames where a flat generic filename risks collision; component public APIs and props will not change.
3. The supported compiler baseline will be TypeScript target ES2020 unless an audit shows every registry item can safely support an earlier target.
4. A full ESLint setup is out of scope unless the existing project already contains an intended lint configuration; the release smoke test will still type-check generated fixtures.
5. `llms.txt` will remain generated from registry metadata rather than becoming a manually maintained duplicate catalog.

## Review gate

Approve or amend this module map and assumptions. After approval, I will write one concise spec for the first module (`registry-onboarding`) and stop again for its review, as required by the reliability-release workflow.
