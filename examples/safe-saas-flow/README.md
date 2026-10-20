# Safe SaaS flow

A compact reference for a settings page that protects a money transfer and a destructive workspace action. It is intentionally local-only: replace the `onSend` and `onDelete` callbacks with your authenticated, server-enforced requests.

## Install

Add the Bollard registry to your app's `components.json`:

```json
{
  "registries": {
    "@bollard": "https://bollard-ui.vercel.app/r/{name}.json"
  }
}
```

Then install the two workflow packs:

```bash
npx shadcn@latest add @bollard/fintech-pack @bollard/danger-zone-pack
```

Copy `safe-transfer-form.tsx` into a client component and adapt its imports to the paths selected by your shadcn configuration.

## Safety boundary

The components improve recognition, confirmation and recovery in the browser. They do not authorize requests, guarantee idempotency or delete data. Keep those controls on the server.
