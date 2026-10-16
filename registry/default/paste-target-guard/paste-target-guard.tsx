"use client"

import * as React from "react"
import { CircleCheck, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type PasteTargetKind = "iban" | "upi" | "crypto"

const PATTERNS: [PasteTargetKind, RegExp][] = [
  ["iban", /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/],
  ["upi", /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/],
  ["crypto", /^(0x[0-9a-f]{40}|bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|T[1-9A-HJ-NP-Za-km-z]{33}|[1-9A-HJ-NP-Za-km-z]{32,44})$/],
]

/** Canonical form for comparing: IBANs without spaces in capitals, UPI IDs lowercased, EVM addresses without checksum case. */
export function normalizePasteTarget(value: string, kind?: PasteTargetKind | null) {
  const compact = value.trim().replace(/[\s\u200b-\u200d\ufeff]+/g, "")
  if (kind === "iban" || (!kind && /^[a-z]{2}\d{2}/i.test(compact) && !compact.includes("@"))) return compact.toUpperCase()
  if (kind === "upi" || compact.includes("@") || /^0x/i.test(compact)) return compact.toLowerCase()
  return compact
}

/** Which kind of payment target a string is, or null. */
export function detectPasteTarget(value: string): PasteTargetKind | null {
  return PATTERNS.find(([kind, re]) => re.test(normalizePasteTarget(value, kind)))?.[0] ?? null
}

export const chunkValue = (value: string, size = 4) => value.match(new RegExp(`.{1,${size}}`, "g")) ?? []

/** Compares two targets group by group, including whether the ends match (the look-alike trick). */
export function compareTargets(a: string, b: string, { kind, chunkSize = 4 }: { kind?: PasteTargetKind | null; chunkSize?: number } = {}) {
  const x = normalizePasteTarget(a, kind)
  const y = normalizePasteTarget(b, kind)
  const left = chunkValue(x, chunkSize)
  const right = chunkValue(y, chunkSize)
  const pairs = Array.from({ length: Math.max(left.length, right.length) }, (_, i) => ({ a: left[i] ?? "", b: right[i] ?? "", diff: left[i] !== right[i] }))
  return { same: x === y, pairs, differing: pairs.filter((p) => p.diff).length, endsMatch: x !== y && x.slice(0, 4) === y.slice(0, 4) && x.slice(-4) === y.slice(-4) }
}

const COPY_EVENT = "bollard-ui:paste-target-copy"

/**
 * Tells every PasteTargetGuard on the page what a copy button just put on the clipboard. Buttons that copy with
 * navigator.clipboard.writeText fire no copy event, so call this next to it.
 */
export function rememberPasteTarget(value: string) {
  document.dispatchEvent(new CustomEvent(COPY_EVENT, { detail: value }))
}

export interface KnownTarget {
  label: string
  value: string
}

/** A saved target this one imitates: same first and last four characters, different in between (address poisoning). */
export const findLookalike = (value: string, known: KnownTarget[], kind?: PasteTargetKind | null) =>
  known.find((k) => compareTargets(k.value, value, { kind }).endsMatch)

function Pair({ a, b, diff, tone }: { a: string; b: string; diff?: boolean; tone?: string }) {
  const chars = (text: string, other: string) => [...text].map((c, i) => (c !== other[i] ? <b key={i} className="font-bold underline decoration-2 underline-offset-2">{c}</b> : c))
  return (
    <span data-diff={diff || undefined} className={cn("grid gap-0.5 rounded px-0.5 py-0.5 text-center font-mono text-xs", diff ? "bg-red-500/15 text-red-800 dark:text-red-300" : tone ?? "text-muted-foreground")}>
      <span>{diff ? chars(a, b) : a || "–"}</span>
      <span className={cn(!diff && "text-foreground")}>{diff ? chars(b, a) : b || "–"}</span>
    </span>
  )
}

const buttonClass = "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface PasteTargetGuardProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the value on every change. */
  onValueChange?: (value: string) => void
  /** Force the kind instead of detecting it. */
  kind?: PasteTargetKind
  /** What the user typed or confirmed earlier (step 1, the invoice on file). Compared when nothing was copied on this page. */
  expected?: string
  /** Remember IBANs, UPI IDs and wallet addresses copied anywhere on this page, to compare with what gets pasted. */
  watchCopy?: boolean
  /** Saved recipients. A value that copies one's start and end but not its middle is flagged as a look-alike. */
  known?: KnownTarget[]
  /** Characters per group in the comparison. */
  chunkSize?: number
  /** Groups shown at each end before the middle collapses. */
  edgeGroups?: number
  /** Called when a mismatch is shown. */
  onMismatch?: (detail: { value: string; reference: string; source: "copied" | "expected" | "known" }) => void
  /** Title when the paste differs from what was copied. */
  copiedTitle?: string
  /** Title when the value differs from the expected one. */
  expectedTitle?: string
  /** `{label}` is filled in. */
  lookalikeTitle?: string
  /** Explains the copied-vs-pasted mismatch. */
  copiedText?: string
  /** Title and text when the page lost focus after the copy, so the user may have copied something else since. */
  staleCopiedTitle?: string
  /** Explains a mismatch with an older copy. */
  staleCopiedText?: string
  /** Explains the expected-vs-entered mismatch. */
  expectedText?: string
  /** Screen reader summary of the comparison. `{count}` and `{total}` are filled in. */
  differText?: string
  /** Warns that the ends match but the middle differs. */
  endsMatchText?: string
  /** Row label for what was copied. */
  copiedLabel?: string
  /** Row label for the expected value. */
  expectedLabel?: string
  /** Row label for the saved recipient. */
  knownLabel?: string
  /** Row label for what was pasted. */
  pastedLabel?: string
  /** `{count}` is filled in. */
  middleLabel?: string
  /** Accessible label to show every group. */
  showAllLabel?: string
  /** `{label}` is filled in for saved recipients. */
  useLabel?: string
  /** Button text to keep the pasted value. */
  keepLabel?: string
  /** Shown when the paste matches what was copied. */
  matchText?: string
}

/**
 * A field for IBANs, UPI IDs and wallet addresses that catches clipboard hijacking: when what lands in the field
 * differs from what was copied on the page or entered earlier, or imitates a saved recipient's start and end, it
 * shows both side by side in groups (start and end first, with the differing characters marked) and offers the
 * real value in one tap. Comparing every group matters because modern clippers pick look-alikes with matching ends.
 */
export function PasteTargetGuard({
  label = "Recipient",
  value,
  defaultValue = "",
  onValueChange,
  kind,
  expected,
  watchCopy = true,
  known = [],
  chunkSize = 4,
  edgeGroups = 2,
  onMismatch,
  copiedTitle = "This isn't what you copied",
  expectedTitle = "This doesn't match what you entered earlier",
  lookalikeTitle = "Looks like “{label}”, but it isn't",
  copiedText = "It changed between copy and paste. Malware on this device can do that. Check it against the original.",
  staleCopiedTitle = "This isn't what you copied on this page",
  staleCopiedText = "If you copied it from somewhere else since, check it against that. If not, something changed your clipboard.",
  differText = "{count} of {total} groups differ.",
  expectedText = "Check it against the original before you send anything.",
  endsMatchText = "The start and end match, so a quick glance would pass. Look-alikes are built that way.",
  copiedLabel = "Copied",
  expectedLabel = "Earlier",
  knownLabel = "Saved",
  pastedLabel = "Pasted",
  middleLabel = "+{count}",
  showAllLabel = "Show every group",
  useLabel = "Use the original",
  keepLabel = "Keep this one",
  matchText = "Matches what you copied, every character.",
  id,
  className,
  onPaste,
  onBlur,
  ref,
  ...props
}: PasteTargetGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [checked, setChecked] = React.useState(defaultValue)
  const [copied, setCopied] = React.useState<string>()
  const [stale, setStale] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  // The builder's ref and ours both get the input, so focus and checks keep working with a ref passed in.
  const setInput = React.useCallback(
    (node: HTMLInputElement | null) => {
      input.current = node
      const cleanup = typeof ref === "function" ? ref(node) : ref ? void (ref.current = node) : undefined
      return () => {
        input.current = null
        if (typeof cleanup === "function") cleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref) ref.current = null
      }
    },
    [ref],
  )
  const [kept, setKept] = React.useState<string>()
  const [showAll, setShowAll] = React.useState(false)
  const pasting = React.useRef(false)
  const root = React.useRef<HTMLDivElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const type = kind ?? detectPasteTarget(text)

  React.useEffect(() => {
    if (!watchCopy) return
    const remember = () => {
      const el = document.activeElement
      if (root.current?.contains(el)) return
      const selected = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : String(document.getSelection() ?? "")
      if (selected.trim() && detectPasteTarget(selected)) (setCopied(selected.trim()), setStale(false))
    }
    const remembered = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === "string" && detail.trim()) (setCopied(detail.trim()), setStale(false))
    }
    // Leaving the page after copying means the clipboard may hold something copied elsewhere, on purpose.
    const left = () => setStale(true)
    document.addEventListener("copy", remember)
    document.addEventListener("cut", remember)
    document.addEventListener(COPY_EVENT, remembered)
    window.addEventListener("blur", left)
    return () => {
      document.removeEventListener("copy", remember)
      document.removeEventListener("cut", remember)
      document.removeEventListener(COPY_EVENT, remembered)
      window.removeEventListener("blur", left)
    }
  }, [watchCopy])

  const active = !!text.trim() && checked === text && kept !== text
  const reference = copied ?? expected
  const lookalike = active && !reference ? findLookalike(text, known, type) : undefined
  const source = copied ? "copied" : expected ? "expected" : lookalike ? "known" : undefined
  const original = reference ?? lookalike?.value
  const result = active && original ? compareTargets(original, text, { kind: type, chunkSize }) : undefined
  const mismatch = result && !result.same ? result : undefined

  const report = React.useRef(onMismatch)
  report.current = onMismatch
  const mismatchKey = mismatch && source ? `${source}|${original}|${text}` : ""
  React.useEffect(() => {
    if (mismatchKey) report.current?.({ value: text, reference: original!, source: source! })
  }, [mismatchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (next: string, check?: boolean) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (check) setChecked(next)
    setShowAll(false)
  }

  const pairs = mismatch?.pairs ?? []
  const collapse = !showAll && pairs.length > edgeGroups * 2 + 1
  const middle = pairs.slice(edgeGroups, pairs.length - edgeGroups)
  const title = source === "copied" ? (stale ? staleCopiedTitle : copiedTitle) : source === "expected" ? expectedTitle : lookalikeTitle.replace("{label}", lookalike?.label ?? "")
  const refLabel = source === "copied" ? copiedLabel : source === "expected" ? expectedLabel : knownLabel

  return (
    <div ref={root} data-slot="paste-target-guard" data-state={mismatch ? "mismatch" : result?.same ? "match" : "idle"} data-kind={type ?? undefined} className={cn("grid w-full max-w-md gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="font-medium">{label}</label>
      <input
        ref={setInput}
        id={inputId}
        value={text}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-invalid={mismatch ? true : undefined}
        aria-describedby={`${inputId}-check`}
        onPaste={(event) => {
          pasting.current = true
          onPaste?.(event)
        }}
        onChange={(event) => {
          set(event.target.value, pasting.current)
          pasting.current = false
        }}
        onBlur={(event) => {
          setChecked(text)
          onBlur?.(event)
        }}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...props}
      />
      <div id={`${inputId}-check`}>
        {mismatch ? (
          <div role="alert" className="mt-0.5 grid gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 motion-safe:animate-[cui-paste-target-guard-in_250ms_ease-out]">
            <style>{`@keyframes cui-paste-target-guard-in { from { opacity: 0; transform: translateY(-4px) } }`}</style>
            <p className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
              <ShieldAlert aria-hidden className="size-4 shrink-0" />
              {title}
            </p>
            <p className="text-xs text-muted-foreground">
              {source === "copied" ? (stale ? staleCopiedText : copiedText) : expectedText} {mismatch.endsMatch && <strong className="font-medium text-foreground">{endsMatchText}</strong>}
            </p>
            <p className="sr-only">
              {differText.replace("{count}", String(mismatch.differing)).replace("{total}", String(pairs.length))}
            </p>
            <div className="flex flex-wrap gap-x-1 gap-y-2">
              <span className="grid gap-0.5 py-0.5 pe-0.5 text-xs text-muted-foreground">
                <span>{refLabel}</span>
                <span className="text-foreground">{pastedLabel}</span>
              </span>
              {(collapse ? pairs.slice(0, edgeGroups) : pairs).map((p, i) => <Pair key={i} {...p} />)}
              {collapse && (
                <button type="button" onClick={() => setShowAll(true)} aria-label={showAllLabel} title={showAllLabel} className="grid gap-0.5 rounded border border-dashed px-1.5 py-0.5 font-mono text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <span>{middleLabel.replace("{count}", String(middle.length))}</span>
                  <span className={cn(middle.some((p) => p.diff) && "font-bold text-red-700 dark:text-red-400")}>{middle.filter((p) => p.diff).length ? `${middle.filter((p) => p.diff).length}≠` : "="}</span>
                </button>
              )}
              {collapse && pairs.slice(-edgeGroups).map((p, i) => <Pair key={`end-${i}`} {...p} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  set(original!, true)
                  input.current?.focus()
                }} className={cn(buttonClass, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                {useLabel.replace("{label}", lookalike?.label ?? "")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setKept(text)
                  input.current?.focus()
                }} className={cn(buttonClass, "border bg-background hover:bg-accent dark:bg-input/30")}>
                {keepLabel}
              </button>
            </div>
          </div>
        ) : (
          <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            {result?.same && source === "copied" && (<><CircleCheck aria-hidden className="size-3.5" />{matchText}</>)}
          </p>
        )}
      </div>
    </div>
  )
}
