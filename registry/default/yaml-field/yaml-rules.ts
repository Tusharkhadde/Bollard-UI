/** Every kind of YAML slip `checkYaml` reports. */
export type YamlMistake = "tab" | "indent" | "dedent" | "boolean" | "version" | "octal" | "sexagesimal" | "duplicate"

export interface YamlEdit {
  from: number
  to: number
  insert: string
}

export interface YamlIssue {
  mistake: YamlMistake
  message: string
  /** Offset and length of the problem span. */
  index: number
  length: number
  /** 1-based line and column. */
  line: number
  column: number
  /** What a YAML 1.1 loader will actually read, e.g. `false` for NO. */
  reads?: string
  /** For duplicate keys: the line that set it first. */
  firstLine?: number
  /** Edits that fix it, last in the text first. */
  fix?: YamlEdit[]
}

/** Plain scalars YAML 1.1 loaders (PyYAML, Psych, SnakeYAML, go-yaml v2) turn into something else. */
export function readsAs(scalar: string, isKey = false): { mistake: YamlMistake; reads: string } | null {
  if (/^(yes|Yes|YES|on|On|ON)$/.test(scalar) || (!isKey && /^[yY]$/.test(scalar))) return { mistake: "boolean", reads: "true" }
  if (/^(no|No|NO|off|Off|OFF)$/.test(scalar) || (!isKey && /^[nN]$/.test(scalar))) return { mistake: "boolean", reads: "false" }
  if (isKey) return null
  if (/^\d+\.\d*0$/.test(scalar)) return { mistake: "version", reads: String(parseFloat(scalar)) }
  if (/^0[0-7]+$/.test(scalar)) return { mistake: "octal", reads: String(parseInt(scalar, 8)) }
  if (/^\d+(:[0-5]?\d)+$/.test(scalar)) return { mistake: "sexagesimal", reads: String(scalar.split(":").reduce((n, part) => n * 60 + Number(part), 0)) }
  return null
}

const MESSAGES: Record<string, (s: string, r: string) => string> = {
  boolean: (s, r) => `${s} is read as the boolean ${r}.`,
  version: (s, r) => `${s} is read as the number ${r}; the trailing zero is lost.`,
  octal: (s, r) => `${s} is read as the octal number ${r}.`,
  sexagesimal: (s, r) => `${s} is read as the base-60 number ${r}.`,
}

const quote = (scalar: string) => (scalar.includes('"') ? `'${scalar}'` : `"${scalar}"`)

/**
 * Line-based YAML checker for hand-edited config: tabs in indentation, a block indented
 * differently from the rest of the file, a dedent that lines up with no parent, the Norway
 * problem (NO, yes, on, off), versions like 1.10, octal-looking 0755, base-60 22:30 and duplicate
 * keys. It skips block scalars and comments, and every issue says what the parser will read.
 */
export function checkYaml(source: string): YamlIssue[] {
  const issues: Omit<YamlIssue, "line" | "column">[] = []
  const lines = source.split("\n")
  const starts = lines.reduce<number[]>((acc, line, i) => [...acc, i ? acc[i - 1] + lines[i - 1].length + 1 : 0], [])
  let unit = 0
  let levels = [0]
  let frames: { indent: number; keys: Map<string, number> }[] = []
  let opens = true // the last line ends in `key:` or `-`, so the next one may nest
  let blockAbove = -1 // indent of the key that opened a | or > block, while inside it

  /** Shifts a line and every deeper line under it by `by` spaces. */
  const shiftBlock = (from: number, indent: number, by: number): YamlEdit[] => {
    const edits: YamlEdit[] = []
    for (let i = from; i < lines.length; i++) {
      const own = lines[i].match(/^ */)![0].length
      if (i > from && lines[i].trim() && own <= indent) break
      if (!lines[i].trim()) continue
      edits.unshift(by > 0 ? { from: starts[i], to: starts[i], insert: " ".repeat(by) } : { from: starts[i], to: starts[i] - by, insert: "" })
    }
    return edits
  }

  const scalar = (text: string, at: number, isKey: boolean) => {
    const found = readsAs(text, isKey)
    if (found) issues.push({ mistake: found.mistake, reads: found.reads, message: MESSAGES[found.mistake](text, found.reads), index: at, length: text.length, fix: [{ from: at, to: at + text.length, insert: quote(text) }] })
  }

  lines.forEach((line, n) => {
    const start = starts[n]
    const lead = line.match(/^[ \t]*/)![0]
    if (!line.trim() || line.trim().startsWith("#")) return
    if (blockAbove >= 0 && lead.replace(/\t/g, " ").length > blockAbove) return
    blockAbove = -1
    if (/^(---|\.\.\.)(\s|$)/.test(line)) {
      levels = [0]
      frames = []
      opens = true
      return
    }
    if (lead.includes("\t")) {
      issues.push({ mistake: "tab", message: "YAML doesn't allow tabs for indentation.", index: start + lead.indexOf("\t"), length: 1, fix: [{ from: start, to: start + lead.length, insert: lead.replace(/\t/g, " ".repeat(unit || 2)) }] })
    }
    const indent = lead.replace(/\t/g, " ".repeat(unit || 2)).length

    // Indentation: a deeper line opens one level, a shallower one must land on an open level.
    const top = levels[levels.length - 1]
    if (indent > top && !opens) {
      issues.push({ mistake: "indent", message: `Indented deeper than the line above, which already has a value. Line it up at ${top} spaces.`, index: start, length: indent, fix: shiftBlock(n, indent, top - indent) })
    } else if (indent > top) {
      if (!unit) unit = indent - top
      else if (indent - top !== unit && !lead.includes("\t"))
        issues.push({ mistake: "indent", message: `Indented ${indent - top} ${indent - top === 1 ? "space" : "spaces"}; the rest of the file uses ${unit}.`, index: start, length: indent, fix: shiftBlock(n, indent, top + unit - indent) })
      levels.push(lead.includes("\t") || indent - top === unit ? indent : top + unit)
    } else if (indent < top) {
      while (levels.length > 1 && levels[levels.length - 1] > indent) levels.pop()
      const parent = levels[levels.length - 1]
      if (parent !== indent) {
        issues.push({ mistake: "dedent", message: `Lines up with no parent; use ${parent} spaces.`, index: start, length: Math.max(1, indent), fix: shiftBlock(n, indent, parent - indent) })
      }
    }

    // Content: optional "- ", then `key: value` or a bare scalar.
    let at = lead.length
    let rest = line.slice(at)
    let col = indent
    const dash = rest.match(/^-(?:[ \t]+|$)/)
    if (dash) {
      at += dash[0].length
      rest = rest.slice(dash[0].length)
      col += dash[0].length
      frames = frames.filter((f) => f.indent < col)
      // `- key: v` opens a mapping at the column after the dash; its siblings line up there.
      if (rest.trim() && levels[levels.length - 1] < col) levels.push(col)
    }
    const key = rest.match(/^("[^"]*"|'[^']*'|[^\s#'"\[{][^#]*?)[ \t]*:(?=[ \t]|$)/)
    if (key) {
      frames = frames.filter((f) => f.indent <= col)
      let frame = frames.find((f) => f.indent === col)
      if (!frame) frames.push((frame = { indent: col, keys: new Map() }))
      const name = key[1].replace(/^(["'])(.*)\1$/, "$2")
      const first = frame.keys.get(name)
      if (first !== undefined) issues.push({ mistake: "duplicate", message: `"${name}" is already set on line ${first + 1}; this one silently wins.`, index: start + at, length: key[1].length, firstLine: first + 1 })
      else frame.keys.set(name, n)
      if (!(col === 0 && key[1] === "on")) scalar(key[1], start + at, true) // GitHub Actions' `on:` is fine
      const after = rest.slice(key[0].length)
      at += key[0].length + (after.length - after.trimStart().length)
      rest = after.trimStart()
    }
    const value = rest.replace(/[ \t]+#.*$/, "").trimEnd()
    opens = !value
    if (/^[|>][-+0-9]*$/.test(value)) blockAbove = indent
    else if (/^\[[^\]\[{}]*\]$/.test(value)) {
      let offset = 1
      for (const item of value.slice(1, -1).split(",")) {
        const lead = item.length - item.trimStart().length
        if (item.trim()) scalar(item.trim(), start + at + offset + lead, false)
        offset += item.length + 1
      }
    } else if (value && !/^["'&*!{\[]/.test(value)) scalar(value, start + at, false)
  })

  return issues
    .sort((a, b) => a.index - b.index)
    .map((issue) => {
      const line = starts.findLastIndex((s) => s <= issue.index)
      return { ...issue, line: line + 1, column: issue.index - starts[line] + 1 }
    })
}

/** Applies the fixes of one or more issues, from the end of the text backwards so offsets stay valid. */
export function fixYaml(source: string, issues: YamlIssue[]) {
  return issues
    .flatMap((issue) => issue.fix ?? [])
    .sort((a, b) => b.from - a.from)
    .reduce((text, edit) => text.slice(0, edit.from) + edit.insert + text.slice(edit.to), source)
}
