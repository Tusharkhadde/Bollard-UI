# Bollard UI CLI

This package is prepared for npm release as `bollard-ui`; it is not published yet. Do not use the `npx bollard-ui` commands until the package has been released.

After release:

```sh
npx bollard-ui init
npx bollard-ui doctor
npx bollard-ui doctor --smoke
```

`init` safely merges the Bollard registry template into an existing `components.json`. `doctor` checks the local registry and aliases. `doctor --smoke` copies the project's package/config files to a temporary directory, installs `amount-input` using shadcn CLI 4.21.0, and runs available typecheck and lint scripts. The smoke check needs network access and removes its temporary fixture when finished.
