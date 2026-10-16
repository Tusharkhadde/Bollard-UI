// Derives a short "Usage" snippet from a component's demo: the import (rewritten
// to where the shadcn CLI puts the file) plus the first JSX element that uses the
// component. Returns null when the demo doesn't yield a clean, short snippet.

const MAX_LINES = 18

function dedent(text: string) {
  const lines = text.split("\n")
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length)
  const min = indents.length ? Math.min(...indents) : 0
  return lines.map((l) => l.slice(min)).join("\n")
}

/** Index just past the `>` that closes the opening tag starting at `start`, skipping braces and strings. */
function endOfOpeningTag(src: string, start: number) {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === "\\") i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") quote = c
    else if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === ">" && depth === 0) return { end: i + 1, selfClosing: src[i - 1] === "/" }
  }
  return null
}

export function usageFromDemo(name: string, demo: string): string | null {
  const importRe = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']@/registry/default/${name}/${name}["']`)
  const imp = demo.match(importRe)
  if (!imp) return null
  const names = imp[1]
    .split(",")
    .map((s) => s.trim().split(/\s+as\s+/).pop()!)
    .filter((s) => /^[A-Z]/.test(s))
  if (!names.length) return null

  // The first element of any imported component, preferring the one named like the file.
  const main = name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())
  const order = [main, ...names.filter((n) => n !== main)].filter((n) => names.includes(n))
  for (const component of order) {
    const at = demo.search(new RegExp(`<${component}[\\s/>]`))
    if (at === -1) continue
    const open = endOfOpeningTag(demo, at)
    if (!open) continue
    let end = open.end
    if (!open.selfClosing) {
      const close = demo.indexOf(`</${component}>`, open.end)
      if (close === -1) continue
      end = close + component.length + 3
    }
    const lineStart = demo.lastIndexOf("\n", at) + 1
    const element = dedent(demo.slice(lineStart, end))
    if (element.split("\n").length > MAX_LINES) continue
    const importLine = imp[0].replace(/\s+/g, " ").replace(`@/registry/default/${name}/${name}`, `@/components/ui/${name}`)
    return `${importLine}\n\n${element}`
  }
  return null
}
