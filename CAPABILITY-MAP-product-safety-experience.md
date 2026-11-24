# Capability Map: Product Safety Experience

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| starter-packs | Registry pack entries, their dependencies, validation, and homepage installation commands | registry catalog |
| hero-comparison | A static, accessible Before/After transfer scenario in the landing hero | amount-input |
| safety-playground | Interactive mock forms whose chaos controls are intercepted by existing safety components | hero-comparison |
| agent-safety | Agent / human-in-the-loop catalog category, navigation badge, and agent pack membership | starter-packs |
| prevention-proof | Fictional, non-attributed prevention examples on the homepage | — |
| preview-controls | Prompt-copy action and persistent accent selection for preview experiences | — |

Build order: starter-packs, prevention-proof, preview-controls → hero-comparison → safety-playground → agent-safety.

## Shared constraints

- Preserve existing public component props and add no runtime dependencies.
- Every control remains keyboard accessible, responsive, and compatible with reduced motion.
- Prevention examples use clearly fictional scenarios; no real companies or incidents are named.
- Registry packs use `registryDependencies` and are validated by the repository registry build.
