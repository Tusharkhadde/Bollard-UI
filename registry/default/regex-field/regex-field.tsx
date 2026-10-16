"use client"

import * as React from "react"
import { Check, CircleX, Plus, Timer, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { anchor, escapeDots, findBacktrackingRisk, findGreedyDot, findUnescapedDots, isAnchored, runRegex, type MatchResult } from "./regex-analyze"

export { anchor, escapeDots, findBacktrackingRisk, findGreedyDot, findUnescapedDots, isAnchored, runRegex } from "./regex-analyze"
export type { BacktrackingRisk, GreedyDot, MatchResult } from "./regex-analyze"

export interface RegexTest {
  text: string
  /** What the pattern should do with this string; drives the pass/fail mark. */
  expect: "match" | "no-match"
}

/** Every user-visible string, so the field can be translated. */
export const REGEX_FIELD_MESSAGES = {
  label: "Pattern",
  flags: "Flags",
  testsLabel: "Test strings",
  addLabel: "Add test",
  testString: (n: number) => `Test string ${n}`,
  removeTest: (n: number) => `Remove test string ${n}`,
  expectMatch: "match",
  expectNoMatch: "no match",
  passes: "Passes",
  fails: "Fails",
  tooSlow: "Stopped: too slow",
  /** Accessible name of the expectation toggle. `verdict` is passes, fails, too slow or "". */
  toggle: (shouldMatch: boolean, verdict: string) => `Should ${shouldMatch ? "match" : "not match"}.${verdict ? ` ${verdict}.` : ""} Toggle expectation.`,
  exponential: (part: string) => `Catastrophic backtracking: ${part} can try exponentially many ways to fail, freezing on a long input.`,
  polynomial: (part: string) => `${part} repeats overlapping characters, which gets slow on long input.`,
  timeout: (ms: number) => `Stopped after ${ms} ms: this pattern hangs on that test string.`,
  dot: "An unescaped . matches any character, not just a dot.",
  anchors: (text: string, part: string) => `“${text}” passes because only “${part}” has to match.`,
  greedy: (stop: string) => `.* is greedy: it runs on to the last “${stop}”, not the first.`,
  trySample: "Add the slow input",
  escapeDot: "Escape it",
  addAnchors: "Add ^ and $",
  useClass: (stop: string) => `Stop at the first “${stop}”`,
}
export type RegexFieldMessages = typeof REGEX_FIELD_MESSAGES

export interface RegexFieldProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Visible label of the pattern. */
  label?: string
  /** Controlled pattern (without slashes). */
  value?: string
  /** Initial pattern when uncontrolled. */
  defaultValue?: string
  /** Called with the pattern on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Controlled flags, e.g. "i". */
  flags?: string
  /** Initial flags when uncontrolled. */
  defaultFlags?: string
  /** Called when the flags change. */
  onFlagsChange?: (flags: string) => void
  /** Controlled test strings with what each should do. */
  tests?: RegexTest[]
  /** Initial test strings when uncontrolled. */
  defaultTests?: RegexTest[]
  /** Called when test strings change. */
  onTestsChange?: (tests: RegexTest[]) => void
  /** Matching budget in ms; past it the worker is killed and the string is marked as hanging. */
  timeLimit?: number
  /** Longest test string accepted. */
  maxLength?: number
  /** @deprecated Use `messages.testsLabel`. */
  testsLabel?: string
  /** @deprecated Use `messages.addLabel`. */
  addLabel?: string
  /** Every visible string: hints, fix labels and accessible names (see `REGEX_FIELD_MESSAGES`). */
  messages?: Partial<RegexFieldMessages>
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const box = "rounded-md border shadow-xs transition-[color,box-shadow] dark:bg-input/30 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
const keyframes = `@keyframes cui-regex-field-mark{0%{background-color:transparent}100%{}}`

function Hint({ children, fix, onFix, tone = "warn" }: { children: React.ReactNode; fix?: string; onFix?: () => void; tone?: "warn" | "slow" }) {
  const Icon = tone === "slow" ? Timer : TriangleAlert
  return (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="py-1">{children}</span>
        {fix ? <button type="button" onClick={onFix} className={fixClass}>{fix}</button> : null}
      </span>
    </p>
  )
}

/** A test string input with its matches highlighted behind the text. */
function TestRow({ test, ranges, maxLength, onChange, onToggle, onRemove, index, t }: {
  test: RegexTest; ranges: MatchResult[number] | undefined; maxLength: number; index: number; t: RegexFieldMessages
  onChange: (text: string) => void; onToggle: () => void; onRemove: () => void
}) {
  const backdrop = React.useRef<HTMLDivElement>(null)
  const matched = Array.isArray(ranges) ? ranges.length > 0 : undefined
  const pass = matched === undefined ? undefined : matched === (test.expect === "match")
  const parts: React.ReactNode[] = []
  let last = 0
  if (Array.isArray(ranges)) for (const [s, e] of ranges) {
    parts.push(test.text.slice(last, s))
    parts.push(<mark key={s} className="rounded-sm bg-sky-400/30 text-transparent motion-safe:animate-[cui-regex-field-mark_250ms_ease-out] dark:bg-sky-400/25">{test.text.slice(s, e) || "\u200b"}</mark>)
    last = e
  }
  parts.push(test.text.slice(last))
  const verdict = ranges === "timeout" ? t.tooSlow : pass === undefined ? "" : pass ? t.passes : t.fails
  return (
    <li className="flex items-center gap-1.5">
      <div className={cn("relative h-9 min-w-0 flex-1 bg-transparent", box, pass === false && "border-red-500/60 dark:border-red-400/60", ranges === "timeout" && "border-amber-500")}>
        <div ref={backdrop} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden px-3 font-mono text-sm leading-[34px] whitespace-pre text-transparent">{parts}</div>
        <input
          value={test.text}
          maxLength={maxLength}
          spellCheck={false}
          aria-label={t.testString(index + 1)}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => backdrop.current && (backdrop.current.scrollLeft = event.currentTarget.scrollLeft)}
          className="relative h-full w-full bg-transparent px-3 font-mono text-sm outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={t.toggle(test.expect === "match", verdict)}
        className={cn(
          "inline-flex h-9 w-21 shrink-0 items-center justify-center gap-1 rounded-md border text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          pass === true && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
          pass === false && "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400",
          ranges === "timeout" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
        )}
      >
        {ranges === "timeout" ? <Timer aria-hidden className="size-3.5" /> : pass === false ? <X aria-hidden className="size-3.5" /> : <Check aria-hidden className="size-3.5" />}
        {test.expect === "match" ? t.expectMatch : t.expectNoMatch}
      </button>
      <button type="button" onClick={onRemove} aria-label={t.removeTest(index + 1)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  )
}

/**
 * A regex input that catches the patterns that look right but aren't: a dot that matches any
 * character, a missing ^…$ that lets "abc123x" through, a greedy .* that runs to the last
 * delimiter, and catastrophic backtracking like (a+)+. Test strings carry an expected result and
 * show their matches live; matching runs in a throwaway Web Worker that is killed after
 * `timeLimit` ms, so even a pathological pattern can't freeze the page.
 */
export function RegexField({
  label,
  value,
  defaultValue = "",
  onValueChange,
  flags: flagsProp,
  defaultFlags = "",
  onFlagsChange,
  tests: testsProp,
  defaultTests = [],
  onTestsChange,
  timeLimit = 100,
  maxLength = 1000,
  testsLabel,
  addLabel,
  messages,
  className,
  id,
  ...props
}: RegexFieldProps) {
  const t: RegexFieldMessages = {
    ...REGEX_FIELD_MESSAGES,
    ...messages,
    ...(label !== undefined && { label }),
    ...(testsLabel !== undefined && { testsLabel }),
    ...(addLabel !== undefined && { addLabel }),
  }
  const [inner, setInner] = React.useState(defaultValue)
  const [innerFlags, setInnerFlags] = React.useState(defaultFlags)
  const [innerTests, setInnerTests] = React.useState(defaultTests)
  const flags = flagsProp ?? innerFlags
  const tests = testsProp ?? innerTests
  const [results, setResults] = React.useState<{ main: MatchResult; lazy?: MatchResult } | null>(null)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const pattern = value ?? inner

  const error = React.useMemo(() => {
    try {
      new RegExp(pattern, flags)
      return null
    } catch (e) {
      return (e as Error).message.replace(/^Invalid (regular expression|flags)[^:]*: (\/.*\/[a-z]*: )?/i, "")
    }
  }, [pattern, flags])
  const risk = error || !pattern ? null : findBacktrackingRisk(pattern)
  const dots = error || !pattern ? [] : findUnescapedDots(pattern)
  const greedy = error || !pattern ? null : findGreedyDot(pattern)
  const texts = React.useMemo(() => tests.map((x) => x.text), [tests])
  const lazySource = greedy?.lazy

  React.useEffect(() => {
    if (error || !pattern) return
    const runs: Array<{ cancel: () => void }> = []
    const timer = setTimeout(() => {
      try {
        const main = runRegex(pattern, flags, texts, timeLimit)
        const lazy = lazySource ? runRegex(lazySource, flags, texts, timeLimit) : null
        runs.push(main, ...(lazy ? [lazy] : []))
        Promise.all([main.result, lazy?.result]).then(([m, l]) => setResults({ main: m, lazy: l }), () => setResults(null))
      } catch {
        setResults(null) // Workers blocked (e.g. by CSP): show no matches rather than risk a hang.
      }
    }, 120)
    return () => {
      clearTimeout(timer)
      runs.forEach((r) => r.cancel())
    }
  }, [pattern, flags, texts, error, timeLimit, lazySource])

  const current = results && pattern && !error ? results : null
  const setPattern = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const updateTests = (next: RegexTest[]) => {
    if (testsProp === undefined) setInnerTests(next)
    onTestsChange?.(next)
  }

  const main = current?.main
  const partial = main && !isAnchored(pattern)
    ? tests.map((x, i) => ({ x, r: main[i] })).find(({ x, r }) => Array.isArray(r) && r.length > 0 && x.expect === "no-match" && !(r[0][0] === 0 && r[0][1] === x.text.length))
    : undefined
  const timedOut = main?.some((r) => r === "timeout")
  const greedyBites = greedy && current?.lazy && main?.some((r, i) => JSON.stringify(r) !== JSON.stringify(current.lazy![i]))

  return (
    <div data-slot="regex-field" className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <style>{keyframes}</style>
      <label htmlFor={fieldId} className="w-fit text-sm font-medium">{t.label}</label>
      <div className={cn("flex h-9 items-center bg-transparent font-mono text-sm", box, error && "border-destructive", !error && (risk || dots.length || partial || greedyBites) && "border-amber-500 dark:border-amber-400")}>
        <span aria-hidden className="pl-3 text-muted-foreground">/</span>
        <input
          id={fieldId}
          value={pattern}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${fieldId}-hints`}
          onChange={(event) => setPattern(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-1 outline-none"
        />
        <span aria-hidden className="text-muted-foreground">/</span>
        <input
          value={flags}
          aria-label={t.flags}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) => {
            if (flagsProp === undefined) setInnerFlags(event.target.value)
            onFlagsChange?.(event.target.value)
          }}
          className="h-full w-10 bg-transparent pr-3 pl-1 outline-none"
        />
      </div>
      <div id={`${fieldId}-hints`} aria-live="polite" className="grid min-h-6 text-xs">
        {error ? (
          <p role="alert" className="flex items-center gap-1.5 py-1 text-destructive"><CircleX aria-hidden className="size-3.5 shrink-0" />{error}</p>
        ) : null}
        {risk ? (
          <Hint
            tone="slow"
            fix={texts.includes(risk.sample) ? undefined : t.trySample}
            onFix={() => updateTests([...tests, { text: risk.sample, expect: "no-match" }])}
          >
            {(risk.severity === "exponential" ? t.exponential : t.polynomial)(pattern.slice(risk.start, risk.end))}
          </Hint>
        ) : null}
        {timedOut ? <Hint tone="slow">{t.timeout(timeLimit)}</Hint> : null}
        {dots.length ? <Hint fix={t.escapeDot} onFix={() => setPattern(escapeDots(pattern, dots))}>{t.dot}</Hint> : null}
        {partial && Array.isArray(partial.r) ? (
          <Hint fix={t.addAnchors} onFix={() => setPattern(anchor(pattern))}>{t.anchors(partial.x.text, partial.x.text.slice(partial.r[0][0], partial.r[0][1]))}</Hint>
        ) : null}
        {greedyBites && greedy ? <Hint fix={t.useClass(greedy.stop)} onFix={() => setPattern(greedy.fixed)}>{t.greedy(greedy.stop)}</Hint> : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{t.testsLabel}</span>
        <button
          type="button"
          onClick={() => updateTests([...tests, { text: "", expect: "match" }])}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus aria-hidden className="size-3.5" />{t.addLabel}
        </button>
      </div>
      <ul className="grid gap-2">
        {tests.map((test, i) => (
          <TestRow
            key={i}
            index={i}
            test={test}
            maxLength={maxLength}
            t={t}
            ranges={main?.[i]}
            onChange={(text) => updateTests(tests.map((x, j) => (j === i ? { ...x, text } : x)))}
            onToggle={() => updateTests(tests.map((x, j) => (j === i ? { ...x, expect: x.expect === "match" ? "no-match" : "match" } : x)))}
            onRemove={() => updateTests(tests.filter((_, j) => j !== i))}
          />
        ))}
      </ul>
    </div>
  )
}
