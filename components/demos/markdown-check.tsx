"use client"

import { MarkdownCheck } from "@/registry/default/markdown-check/markdown-check"

const draft = `#Release 2.4

**Breaking: the \`--force flag is gone.
See the [migration guide] (https://docs.acme.dev/migrate).
<center>Thanks to every contributor!</center>`

export function Demo() {
  return <MarkdownCheck label="Release notes" defaultValue={draft} rows={5} className="max-w-sm" />
}
