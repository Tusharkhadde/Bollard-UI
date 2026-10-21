# Registry compatibility

Bollard's Next.js workspace uses TypeScript `target: "ES2020"`. Most registry items work with the usual shadcn TypeScript defaults; these items use BigInt/Intl BigInt APIs and need an ES2020 target and library declarations:

- `amount-input`
- `cidr-input`
- `epoch-input`

If TypeScript reports that BigInt literals or the `bigint` type are unavailable, update the consuming app's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "es2020"]
  }
}
```

Preserve any additional libraries your application already uses. `amount-input` also needs an ES2020-capable `Intl.NumberFormat` type/runtime for locale-aware formatting of large integer amounts. No target change is needed for items that do not use these APIs.
