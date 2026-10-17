# Security Policy

## Supported versions

Bollard UI is distributed as source you copy into your project, so fixes land on `main` and in the registry at `https://bollard-ui.vercel.app/r/<name>.json`. Only the latest version of each component is supported. To pick up a fix, re-run `npx shadcn@latest add` for that component and review the diff.

## Reporting a vulnerability

Please don't open a public issue for security problems.

Report privately through [GitHub's private vulnerability reporting](https://github.com/Tusharkhadde/Bollard-UI/security/advisories/new), or email **tusharkhadde06@gmail.com** with "Bollard UI security" in the subject.

Include:

- the component (or the docs site) and the version or commit,
- what an attacker can do and how,
- steps or a minimal example to reproduce it.

You can expect an acknowledgement within 3 working days and an update on the fix within 14 days. Once a fix ships we'll credit you in the release notes, unless you'd rather stay anonymous.

## Scope

In scope: a component that leaks data it was meant to protect (for example a secret field or paste guard that exposes the value), cross-site scripting through component props or rendered content, and anything in the docs site or registry files that could harm visitors or people installing components.

Out of scope: components used in ways their docs warn against, and issues in third-party dependencies (please report those upstream, and tell us if a component needs updating).

Note: several demos contain fake, deliberately invalid keys (such as `AKIAIOSFODNN7EXAMPLE` or `sk_live_…Example…`) to show secret detection. They aren't real credentials.
