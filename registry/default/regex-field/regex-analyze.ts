// Bollard UI — regex-field · MIT licence · https://bollard-ui.vercel.app/components/regex-field

/**
 * Static checks for JavaScript regular expressions (they never run the pattern), plus a
 * sandboxed runner that matches in a Web Worker and gives up after a time budget, so a
 * catastrophic pattern can never freeze the page.
 */

type Atom = {
  kind: "char" | "escape" | "class" | "dot" | "anchor" | "group"
  /** The atom without its quantifier. */
  core: string
  start: number
  end: number
  quant?: { min: number; max: number; lazy: boolean }
  /** Alternatives inside a group. */
  alts?: Atom[][]
  look?: boolean
}

/** Lenient parser for an already-valid pattern: top-level alternatives, each a list of atoms. */
function parse(src: string): Atom[][] {
  let i = 0
  const alternation = (): Atom[][] => {
    const alts: Atom[][] = [[]]
    while (i < src.length && src[i] !== ")") {
      const start = i
      const ch = src[i]
      let atom: Atom
      if (ch === "|") {
        alts.push([])
        i++
        continue
      } else if (ch === "(") {
        const prefix = /^\(\?(?:<?[=!]|:|<[^>]+>)?/.exec(src.slice(i))?.[0] ?? "("
        i += prefix.length
        const inner = alternation()
        i++ // ")"
        atom = { kind: "group", core: src.slice(start, i), start, end: i, alts: inner, look: /[=!]/.test(prefix) }
      } else if (ch === "[") {
        i++
        while (i < src.length && src[i] !== "]") i += src[i] === "\\" ? 2 : 1
        i++
        atom = { kind: "class", core: src.slice(start, i), start, end: i }
      } else if (ch === "\\") {
        const m = /^\\(?:[pPu]\{[^}]*\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|c[a-zA-Z]|k<[^>]+>|.)/.exec(src.slice(i))
        i += m?.[0].length ?? 2
        atom = { kind: "escape", core: src.slice(start, i), start, end: i }
      } else {
        i++
        atom = { kind: ch === "." ? "dot" : ch === "^" || ch === "$" ? "anchor" : "char", core: ch, start, end: i }
      }
      const q = /^(?:([*+?])|\{(\d+)(,(\d*))?\})(\?)?/.exec(src.slice(i))
      if (q) {
        const range: [number, number] = q[1] === "*" ? [0, Infinity] : q[1] === "+" ? [1, Infinity] : q[1] === "?" ? [0, 1] : [Number(q[2]), q[3] ? (q[4] ? Number(q[4]) : Infinity) : Number(q[2])]
        atom.quant = { min: range[0], max: range[1], lazy: !!q[5] }
        i += q[0].length
        atom.end = i
      }
      alts[alts.length - 1].push(atom)
    }
    return alts
  }
  return alternation()
}

const unbounded = (a: Atom) => a.quant?.max === Infinity
const optional = (a: Atom) => a.quant?.min === 0 || a.kind === "anchor" || !!a.look
const SAMPLE = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).concat(["\n", "\t", "é"])

/** Which sample characters a single atom accepts (groups accept nothing here). */
function accepts(a: Atom): string[] {
  if (a.kind === "group" || a.kind === "anchor") return []
  try {
    const re = new RegExp(`^(?:${a.core})$`, "u")
    return SAMPLE.filter((ch) => re.test(ch))
  } catch {
    return []
  }
}

/** Whether two atoms can consume the same character. */
const overlaps = (a: Atom, b: Atom) => accepts(a).some((ch) => accepts(b).includes(ch))

/** The literal text of an alternative made only of plain characters, else null. */
const literalText = (alt: Atom[]) => (alt.every((x) => x.kind === "char" && !x.quant) ? alt.map((x) => x.core).join("") : null)

/** Alternatives that can match the same text: one literal is a prefix of another (a|ab), or their first atoms overlap (\w|\d). */
function ambiguousAlternatives(alts: Atom[][]) {
  return alts.some((x, j) =>
    alts.some((y, k) => {
      if (k <= j || !x[0] || !y[0]) return false
      const [lx, ly] = [literalText(x), literalText(y)]
      if (lx !== null && ly !== null) return lx.startsWith(ly) || ly.startsWith(lx)
      return overlaps(x[0], y[0])
    }),
  )
}

/** An atom that can match a variable-length run on its own. */
const flexible = (a: Atom): boolean =>
  unbounded(a) || (a.kind === "group" && !!a.alts?.some((alt) => alt.some(flexible) && alt.every((x) => flexible(x) || optional(x))))

/** A string that makes a vulnerable part backtrack: many of a character it accepts, then one that fails. */
function pumpFor(a: Atom): string {
  let leaf = a
  while (leaf.kind === "group" && leaf.alts) leaf = leaf.alts.flat().find(flexible) ?? leaf.alts.flat()[0] ?? leaf
  const t = leaf.core
  const ch = /^\\d/.test(t) ? "1" : /^\\s/.test(t) ? " " : leaf.kind === "char" ? t : leaf.kind === "escape" && !/[a-zA-Z]/.test(t[1]) ? t[1] : "a"
  return ch.repeat(28) + (ch === "!" ? "?" : "!")
}

export interface BacktrackingRisk {
  severity: "exponential" | "polynomial"
  /** The risky part of the pattern, as offsets into it. */
  start: number
  end: number
  /** A test string that triggers the slow path. */
  sample: string
}

const walk = (pattern: string, fn: (seq: Atom[]) => void) => {
  const visit = (seq: Atom[]) => {
    fn(seq)
    seq.forEach((a) => a.alts?.forEach(visit))
  }
  parse(pattern).forEach(visit)
}

/**
 * Flags catastrophic backtracking: nested repeats like (a+)+ or (\w+\s?)+, repeated groups with
 * overlapping alternatives like (a|ab)*, and adjacent repeats of the same characters like \d+\d+.
 */
export function findBacktrackingRisk(pattern: string): BacktrackingRisk | null {
  let found: BacktrackingRisk | null = null
  walk(pattern, (seq) =>
    seq.forEach((a, i) => {
      if (found) return
      if (a.kind === "group" && a.alts && !a.look && unbounded(a)) {
        const nested = a.alts.some((alt) => {
          const loose = alt.filter(flexible)
          return loose.length > 0 && alt.every((x) => flexible(x) || optional(x) || loose.some((l) => overlaps(l, x)))
        })
        if (nested || ambiguousAlternatives(a.alts)) found = { severity: "exponential", start: a.start, end: a.end, sample: pumpFor(a) }
      }
      const next = seq[i + 1]
      if (!found && next && unbounded(a) && unbounded(next) && overlaps(a, next)) {
        const shared = accepts(a).find((ch) => /\w/.test(ch) && accepts(next).includes(ch)) ?? "a"
        found = { severity: "polynomial", start: a.start, end: next.end, sample: shared.repeat(500) + "!" }
      }
    }),
  )
  return found
}

/** Offsets of dots between literal characters, as in "example.com" or "\d+.\d+": almost always meant literally. */
export function findUnescapedDots(pattern: string): number[] {
  const out: number[] = []
  const literal = (x?: Atom) => !!x && (x.kind === "char" || x.kind === "class" || (x.kind === "escape" && !/^\\[bB]$/.test(x.core)))
  walk(pattern, (seq) => seq.forEach((a, i) => a.kind === "dot" && !a.quant && literal(seq[i - 1]) && literal(seq[i + 1]) && out.push(a.start)))
  return out.sort((a, b) => a - b)
}

/** Escapes the dots at the given offsets. */
export const escapeDots = (pattern: string, at: number[]) => at.reduceRight((p, i) => p.slice(0, i) + "\\" + p.slice(i), pattern)

/** True when every alternative is pinned to both the start (^) and the end ($) of the string. */
export const isAnchored = (pattern: string) => parse(pattern).every((alt) => alt[0]?.core === "^" && alt[alt.length - 1]?.core === "$")

/** Wraps the pattern in ^…$, grouping it first when it has top-level alternatives. */
export function anchor(pattern: string) {
  if (parse(pattern).length > 1) return `^(?:${pattern})$`
  return `^${pattern.replace(/^\^/, "").replace(/(?<!\\)\$$/, "")}$`
}

export interface GreedyDot {
  /** The literal that follows, e.g. ">" in <.+> */
  stop: string
  /** The pattern with that .* / .+ made lazy, for comparing matches. */
  lazy: string
  /** The pattern with it replaced by a negated class, e.g. <[^>]+> */
  fixed: string
}

/** A greedy .* or .+ directly followed by a literal character: it runs past the first one to the last. */
export function findGreedyDot(pattern: string): GreedyDot | null {
  let found: GreedyDot | null = null
  // `follow` is what comes after the sequence, so "(.*)" followed by a quote is caught too.
  const visit = (seq: Atom[], follow?: Atom) =>
    seq.forEach((a, i) => {
      const next = seq[i + 1] ?? follow
      if (a.kind === "group" && !a.look) a.alts?.forEach((alt) => visit(alt, next))
      if (found || a.kind !== "dot" || !unbounded(a) || a.quant?.lazy || !next) return
      if (next.kind !== "char" && !(next.kind === "escape" && /^\\\W$/.test(next.core))) return
      const stop = next.core.slice(-1)
      const cls = `[^${/[\]\\^-]/.test(stop) ? "\\" + stop : stop}]${pattern.slice(a.start + 1, a.end)}`
      found = { stop, lazy: pattern.slice(0, a.end) + "?" + pattern.slice(a.end), fixed: pattern.slice(0, a.start) + cls + pattern.slice(a.end) }
    })
  parse(pattern).forEach((alt) => visit(alt))
  return found
}

/** Match ranges per test string, or "timeout" where the time budget ran out. */
export type MatchResult = Array<Array<[number, number]> | "timeout">

const WORKER = `onmessage = (e) => {
  const { source, flags, texts, limit } = e.data
  const re = new RegExp(source, flags.includes("g") ? flags : flags + "g")
  texts.forEach((t, i) => {
    const ranges = []
    re.lastIndex = 0
    let m
    while (ranges.length < limit && (m = re.exec(t))) {
      ranges.push([m.index, m.index + m[0].length])
      if (m[0] === "") re.lastIndex++
    }
    postMessage({ i, ranges })
  })
}`

/** Runs a pattern over test strings in a throwaway Web Worker, killed after `timeLimit` ms. Browser only. */
export function runRegex(source: string, flags: string, texts: string[], timeLimit = 100, limit = 50) {
  const url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }))
  const worker = new Worker(url)
  const out: MatchResult = texts.map(() => "timeout")
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => {
    clearTimeout(timer)
    worker.terminate()
    URL.revokeObjectURL(url)
  }
  const result = new Promise<MatchResult>((resolve, reject) => {
    let done = 0
    const finish = () => {
      cancel()
      resolve(out)
    }
    timer = setTimeout(finish, timeLimit)
    worker.onerror = (event) => {
      cancel()
      reject(new Error(event.message))
    }
    worker.onmessage = (event: MessageEvent<{ i: number; ranges: Array<[number, number]> }>) => {
      out[event.data.i] = event.data.ranges
      if (++done === texts.length) finish()
    }
    worker.postMessage({ source, flags, texts, limit })
  })
  return { result, cancel }
}
