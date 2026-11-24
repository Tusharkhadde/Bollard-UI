# Spec: Registry Onboarding CLI

## Objective

Provide a publishable, zero-runtime-dependency Bollard CLI that prevents the first-install failure for developers and coding agents. `init` adds the `@bollard` registry template without overwriting unrelated `components.json` configuration. `doctor` reports whether a project is ready to install Bollard items and emits actionable failures.

The package will be prepared in this repository only. Publishing `bollard-ui` to npm and changing its visibility require a separate release decision.

## Tech Stack

- Node.js 20+
- Native `node:fs`, `node:path`, and `node:process`
- Existing Next.js 16 registry project
- No new runtime or development dependencies

## Commands

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run registry:build
npm.cmd run build
node packages/cli/bin/bollard-ui.mjs init --cwd <fixture>
node packages/cli/bin/bollard-ui.mjs doctor --cwd <fixture>
```

## Project Structure

```text
packages/cli/
  package.json                  # publishable package manifest and bin mapping
  bin/bollard-ui.mjs            # init and doctor command entrypoint
  lib/components-json.mjs       # safe components.json reading and update helpers
tests/
  registry-cli.test.mjs         # isolated fixture tests for CLI behavior
```

## Code Style

```js
const registryUrl = "https://bollard-ui.vercel.app/r/{name}.json"

export function withBollardRegistry(config) {
  return {
    ...config,
    registries: { ...config.registries, "@bollard": registryUrl },
  }
}
```

- ESM modules, explicit functions, no third-party parsing package.
- Reject malformed JSON with a clear message and non-zero exit code.
- Preserve all unrelated keys and registries.
- Never log package-manager tokens, environment variables, or file contents beyond the requested path.

## Testing Strategy

- Unit tests cover a missing `components.json`, an existing configuration, an existing equivalent Bollard namespace, a conflicting namespace, malformed JSON, and `doctor` exit states.
- Tests use temporary fixtures under the operating system temp directory and clean them after each test.
- `doctor` remains offline by default; registry network reachability is a separate opt-in check after deployment.

## Boundaries

- Always: preserve unrelated configuration, use atomic writes, verify fixture output, run the full project test suite before pushing.
- Ask first: publishing to npm, changing the root package from private, adding dependencies, changing CI.
- Never: overwrite a conflicting `@bollard` URL silently, send project configuration off-device, embed API keys, or alter a consuming project outside an explicit `--cwd` target.

## Success Criteria

1. `init --cwd <project>` creates or updates only `registries.@bollard` with `https://bollard-ui.vercel.app/r/{name}.json`.
2. A matching existing registry is idempotent and exits successfully without changing content.
3. A conflicting namespace fails with a clear remediation message and leaves the file untouched.
4. `doctor --cwd <project>` reports missing configuration, a correct configuration, a conflicting configuration, and missing shadcn setup distinctly.
5. The CLI package declares a `bollard-ui` executable but no package is published or made public during implementation.
6. No runtime dependencies are added.

## Open Questions

- The desired npm package name `bollard-ui` may already be owned. Publication must check availability and ownership before a release.
- The exact lint command remains unresolved because the root repository has no lint script or ESLint configuration.
