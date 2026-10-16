"use client"

import * as React from "react"
import { CircleAlert, Landmark, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { branchWithZeros, findIfscProblem, IFSC_BANK_CODES, IFSC_PATTERN, normalizeIfsc, sameBank, type IfscDetails, type IfscRail } from "./ifsc"

export { branchWithZeros, createRazorpayIfscLookup, findIfscProblem, IFSC_BANK_CODES, IFSC_GUESSED_CODES, IFSC_PATTERN, normalizeIfsc, sameBank, type IfscDetails, type IfscProblem, type IfscRail } from "./ifsc"

type Lookup = { code: string; state: "checking" } | { code: string; state: "done"; details: IfscDetails | null } | { code: string; state: "failed" }

export interface IfscInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled IFSC (cleaned and uppercased). */
  value?: string
  /** Initial IFSC when uncontrolled. */
  defaultValue?: string
  /** Called with the cleaned, uppercased code on every change. */
  onValueChange?: (value: string) => void
  /** Finds the branch for a complete code. Resolve null when it doesn't exist. See createRazorpayIfscLookup. */
  lookup?: (ifsc: string, signal: AbortSignal) => Promise<IfscDetails | null>
  /** Called with the branch once found, or null when the code changes or isn't found. */
  onDetailsChange?: (details: IfscDetails | null) => void
  /** The bank the user picked earlier in the form (name or 4-letter code), compared with the IFSC's bank. */
  expectedBank?: string
  /** Offers a one-tap switch of the picked bank when it doesn't match the IFSC. */
  onUseBank?: (bankCode: string, bankName: string) => void
  /** A payment rail this transfer needs; warns when the branch doesn't support it. */
  requiredRail?: IfscRail
  /** Text after the IFSC's bank in the mismatch warning, before the picked bank. */
  mismatchMessage?: string
  /** Shown when the lookup finds no branch. */
  notFoundMessage?: string
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent pr-14 pl-3 font-mono text-base tracking-wider uppercase shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const reveal = "motion-safe:animate-[cui-ifsc-input-reveal_250ms_ease-out]"
const RAILS: IfscRail[] = ["NEFT", "RTGS", "IMPS", "UPI"]

/**
 * An IFSC field that stops transfers going to the wrong branch. It catches the
 * letter O typed for the zero in 5th place, a missing 0, digits in the bank code
 * and guessed prefixes (AXIS for UTIB), then reads the branch back from a
 * pluggable lookup and warns when it belongs to a different bank than the one picked.
 */
export function IfscInput({
  label = "IFSC",
  value,
  defaultValue = "",
  onValueChange,
  lookup,
  onDetailsChange,
  expectedBank,
  onUseBank,
  requiredRail,
  mismatchMessage = "but you picked",
  notFoundMessage = "No branch has this IFSC.",
  id,
  className,
  ref,
  ...props
}: IfscInputProps) {
  const [inner, setInner] = React.useState(normalizeIfsc(defaultValue))
  const [result, setResult] = React.useState<Lookup>()
  const [attempt, setAttempt] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const code = value ?? inner
  const complete = IFSC_PATTERN.test(code)
  const lookupRef = React.useRef(lookup)
  const detailsRef = React.useRef(onDetailsChange)
  React.useEffect(() => {
    lookupRef.current = lookup
    detailsRef.current = onDetailsChange
  })

  React.useEffect(() => {
    if (!complete || !lookupRef.current) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setResult({ code, state: "checking" })
      lookupRef.current!(code, controller.signal).then(
        (details) => {
          if (controller.signal.aborted) return
          setResult({ code, state: "done", details })
          detailsRef.current?.(details)
        },
        () => !controller.signal.aborted && setResult({ code, state: "failed" })
      )
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [code, complete, attempt])

  const update = (next: string) => {
    const clean = normalizeIfsc(next).slice(0, 14)
    if (value === undefined) setInner(clean)
    if (clean !== code) detailsRef.current?.(null)
    onValueChange?.(clean)
  }

  const current = result?.code === code ? result : undefined
  const details = current?.state === "done" ? current.details : undefined
  const problem = findIfscProblem(code)
  const bankCode = details?.bankCode ?? (code.length >= 4 && !problem ? code.slice(0, 4) : "")
  const bankName = details?.bank ?? IFSC_BANK_CODES[bankCode]
  const mismatch = !!expectedBank && !!bankName && !sameBank(expectedBank, bankCode, bankName)
  const zeroed = details === null ? branchWithZeros(code) : null
  const missingRail = details && requiredRail && details[requiredRail.toLowerCase() as Lowercase<IfscRail>] === false
  const warnLine = (text: React.ReactNode, action?: React.ReactNode) => (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="py-1">{text}</span>{action}</span>
    </p>
  )

  return (
    <div data-slot="ifsc-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{`@keyframes cui-ifsc-input-reveal{from{opacity:0;transform:translateY(-4px)}}`}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={18}
          placeholder="e.g. HDFC0001234"
          value={code}
          onChange={(e) => update(e.target.value)}
          aria-describedby={`${inputId}-status`}
          aria-invalid={details === null || undefined}
          data-warning={problem || mismatch ? "" : undefined}
          className={field}
          {...props}
        />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground tabular-nums">
          {code.length}/11
        </span>
      </div>
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1.5 text-xs">
        {problem
          ? warnLine(problem.message, problem.fix && <button type="button" onClick={() => update(problem.fix!)} className={fix}>{problem.fixLabel}</button>)
          : !complete && bankName && <p className="py-1 text-muted-foreground">{bankCode} is {bankName}</p>}
        {current?.state === "checking" && (
          <p className="flex items-center gap-1.5 py-1 text-muted-foreground motion-safe:animate-pulse">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> Finding the branch…
          </p>
        )}
        {current?.state === "failed" &&
          warnLine("Couldn't look up the branch.", (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={fix}><RotateCw aria-hidden className="size-3" /> Retry</button>
          ))}
        {details === null && (
          <div role="alert" className={cn("flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-sm text-red-900 dark:text-red-100", reveal)}>
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="grid gap-1.5">
              <p>{notFoundMessage} Check it against a cheque leaf or the bank&apos;s site.</p>
              {zeroed && (
                <button type="button" onClick={() => update(zeroed)} className="w-fit rounded-md border border-red-500/30 px-2 py-0.5 text-xs font-medium hover:bg-red-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  Try <span className="font-mono">{zeroed}</span> (zeros, not O)
                </button>
              )}
            </div>
          </div>
        )}
        {details && (
          <div className={cn("flex gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5 text-sm", reveal)}>
            <Landmark aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="grid min-w-0 gap-0.5">
              <p className="font-medium">{details.bank}</p>
              <p className="text-muted-foreground">
                {details.branch}
                {details.city && ` · ${[details.city, details.state].filter(Boolean).join(", ")}`}
              </p>
              <p className="mt-1 flex flex-wrap gap-1">
                <span className="mr-1 font-mono text-xs tracking-wider">{code.slice(0, 4)} <span className="text-muted-foreground">0</span> {code.slice(5)}</span>
                {RAILS.map((rail) => {
                  const ok = details[rail.toLowerCase() as Lowercase<IfscRail>]
                  return ok === undefined ? null : (
                    <span key={rail} className={cn("rounded px-1.5 text-[11px] leading-5 font-medium", ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground line-through")}>
                      {rail}
                    </span>
                  )
                })}
              </p>
            </div>
          </div>
        )}
        {mismatch &&
          warnLine(
            <>This IFSC is for <span className="font-medium">{bankName}</span>, {mismatchMessage} <span className="font-medium">{IFSC_BANK_CODES[expectedBank!.toUpperCase()] ?? expectedBank}</span>.</>,
            onUseBank && <button type="button" onClick={() => onUseBank(bankCode, bankName!)} className={fix}>Switch to {bankName}</button>
          )}
        {missingRail && warnLine(`This branch doesn't accept ${requiredRail} transfers.`)}
      </div>
    </div>
  )
}
