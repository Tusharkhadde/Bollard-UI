# Spec: Agent Safety Category

## Objective

Make agent/human-in-the-loop safety discoverable as a catalog category and navigation badge, with a dedicated agent pack.

## Commands

`npm test`, `npm run lint`, `npm run typecheck`, `npm run registry:build`.

## Project Structure

`scripts/generate.mjs`, catalog helpers, navigation, and registry metadata determine classification.

## Code Style

Use existing category labels and plain-text status: `Agent / Human-in-the-loop`.

## Testing Strategy

Assert category membership, navigation label, and agent pack dependencies.

## Boundaries

- Always: retain forms and critical actions as the primary landing message.
- Ask first: altering all category mappings.
- Never: imply UI approval is an enforcement boundary.

## Success Criteria

- `agent-action-approve`, `ai-paste-guard`, `undo-toast`, and directly related items are in agent-pack and discoverable by the category.

## Open Questions

None.
