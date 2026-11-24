# A Component Catalog Hardening Pass: Storage, Async Errors, and SEO in Next.js

Large component catalogs need more than a good default state. A control can look correct with valid props and still break when browser storage is blocked, persisted JSON is malformed, an async callback rejects, or a permission prompt is dismissed.

I audited Bollard UI, a catalog with 341 interactive demos and 352 registry entries, looking for failure paths that repeat across components. The most useful fixes were cross-cutting: make browser APIs optional, validate persisted data at the boundary, show recoverable errors, and ensure every public route has clear search and sharing metadata.

## Start with the boundary where data enters

Browser storage is an unreliable dependency. It can be disabled, full, or contain data written by an older version of a component. A successful `JSON.parse` does not prove the result has the shape the component expects.

For example, a resume marker should validate both the stored key and its timestamp before using them:

```tsx
export function readPosition(storageKey: string, now: number, maxAge = 30 * DAY) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null")
    if (!value || typeof value !== "object") return null

    const saved = value as Partial<SavedPosition>
    return typeof saved.key === "string" && saved.key.length > 0 &&
      Number.isFinite(saved.at) && saved.at! <= now &&
      maxAge > 0 && now - saved.at! < maxAge
      ? saved as SavedPosition
      : null
  } catch {
    return null
  }
}
```

Storage writes need the same care. If remembering a position fails, reading and scrolling should still work. If an offline autosave cannot keep a local copy, its status should say that instead of claiming the draft is safe on the device.

The same boundary rule applies to cross-tab messages. Treat a storage event or `BroadcastChannel` payload as `unknown`, validate its discriminant and fields, and ignore malformed messages. A browser message is input, even when it came from another tab on the same origin.

## Async errors should be recoverable and safe to show

An async action needs visible pending and failure states. The person should know whether the action completed and what they can try next. Raw exception messages are often implementation details, so a component should show a safe default message and let the application provide copy when it has a user-safe explanation.

The same idea applies to permission APIs. A screen-share picker can be unsupported, blocked, or dismissed. The demo should explain that the action did not start and leave the rest of the interface usable. Clipboard demos should provide a manual path when browser permission blocks copying.

## Keep validation strict without making it generic

Strict validation works best at the component boundary and follows that component’s domain. A saved timestamp must be finite and not in the future. A time-zone identifier must be recognized before formatting. A form field needs its own rule and accessible error relationship. One generic “validate everything” layer cannot replace those contracts.

For async validation, a shared field hook can still own common behavior: stale request suppression, pending state, visible field errors, and accessible `aria-invalid` / `aria-describedby` props. The field’s actual validation rules stay with the field.

## Treat search metadata as part of the route contract

The site already had dynamic metadata for component pages and sitemap and robots routes. The hardening pass filled gaps around the interactive playground and social cards, and added home-page Organization and WebSite structured data. Every public route should have a useful title and description, a canonical URL where appropriate, and preview metadata that matches its page.

Structured data helps search engines interpret a page; it does not guarantee a rich result. Google recommends Organization markup on a home or organization page, and describes sitemaps as a discovery aid rather than an indexing guarantee ([Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization), [sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)).

## Verify the catalog, not just the homepage

The production build checks TypeScript and prerenders routes, while registry validation checks the installable component payloads. In this pass, lint and the production build succeeded, and the registry validator checked 352 entries with zero errors or warnings. I did not run the test suite as part of this pass.

The takeaway is practical: harden repeated failure boundaries once, then keep validation specific to each component’s inputs. A catalog becomes dependable when its demos, installable files, persisted state, error copy, and public routes all describe what happens when something goes wrong.
