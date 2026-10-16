"use client"

import * as React from "react"
import { Globe, Layers, Network, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeCidr, formatAddress, formatSize, type ExistingRange } from "./cidr"

export { analyzeCidr, formatAddress, formatSize, type CidrAnalysis, type CidrOverlap, type ExistingRange } from "./cidr"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const NONE: ExistingRange[] = []

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-danger:border-red-500 dark:data-danger:border-red-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-mono font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface CidrInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change. */
  onValueChange?: (value: string) => void
  /** Ranges already in use; an overlap with any of them is flagged by name. */
  existing?: ExistingRange[]
  /** Pause in ms before warnings appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Templates. `{first}`, `{last}`, `{count}`, `{network}`, `{host}`, `{prefix}`, `{label}`, `{cidr}`, `{all}` are filled in. */
  rangeText?: string
  /** Warning when host bits are set. */
  hostBitsText?: string
  /** Warning for leading zeros in an octet. */
  leadingZerosText?: string
  /** Warning when the /prefix is missing. */
  missingPrefixText?: string
  /** Warning for 0.0.0.0/0 or ::/0. */
  anywhereText?: string
  /** Message when the range equals an existing one. */
  sameText?: string
  /** Message when the range sits inside an existing one. */
  insideText?: string
  /** Message when the range contains an existing one. */
  containsText?: string
}

/**
 * A CIDR field for firewall rules, VPCs and allowlists. It reads back the exact
 * range and address count, catches host bits set (10.0.0.1/8 silently means
 * all of 10.0.0.0/8, or was it just one host?) and offers both readings, warns
 * when a rule opens to the whole internet, and names any existing range it overlaps.
 */
export function CidrInput({
  label = "CIDR range",
  value,
  defaultValue = "",
  onValueChange,
  existing = NONE,
  delay = 500,
  rangeText = "{first} – {last} · {count} {addresses}",
  hostBitsText = "Host bits are set. Did you mean the network, or just this address?",
  leadingZerosText = "Leading zeros can be read as octal (010 = 8).",
  missingPrefixText = "No prefix, so this is a single address.",
  anywhereText = "This is open to the whole internet: every {all} address.",
  sameText = "Same range as {label} ({cidr}).",
  insideText = "Inside {label} ({cidr}).",
  containsText = "Contains {label} ({cidr}).",
  id,
  className,
  onBlur,
  ref,
  ...props
}: CidrInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [settled, setSettled] = React.useState(defaultValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const apply = (next: string) => {
    update(next)
    setSettled(next)
    inputRef.current?.focus()
  }

  const result = React.useMemo(() => (text.trim() ? analyzeCidr(text, existing) : null), [text, existing])
  const ready = settled === text
  const invalid = ready && result && !result.ok ? result : null
  const ok = result?.ok ? result : null
  const fullBits = ok ? (ok.family === 4 ? 32 : 128) : 32
  const host = ok ? `${formatAddress(ok.address, ok.family)}/${fullBits}` : ""
  const values: Record<string, string> = ok
    ? {
        first: formatAddress(ok.network, ok.family),
        last: formatAddress(ok.last, ok.family),
        count: formatSize(ok.size),
        addresses: ok.size === BigInt(1) ? "address" : "addresses",
        network: ok.canonical,
        host,
        prefix: `/${fullBits}`,
        all: `IPv${ok.family}`,
      }
    : {}
  const warnings: {
    key: string
    icon: typeof Globe
    text: string
    danger?: boolean
    fixes?: string[]
  }[] = []
  if (ok && ready) {
    if (ok.anywhere)
      warnings.push({
        key: "any",
        icon: Globe,
        text: fill(anywhereText, values),
        danger: true,
      })
    if (ok.hostBitsSet)
      warnings.push({
        key: "host",
        icon: TriangleAlert,
        text: fill(hostBitsText, values),
        fixes: [ok.canonical, host],
      })
    else if (ok.leadingZeros)
      warnings.push({
        key: "zeros",
        icon: TriangleAlert,
        text: leadingZerosText,
        fixes: [ok.canonical],
      })
    if (ok.missingPrefix)
      warnings.push({
        key: "prefix",
        icon: TriangleAlert,
        text: missingPrefixText,
        fixes: [host],
      })
    for (const overlap of ok.overlaps) {
      const template = {
        same: sameText,
        inside: insideText,
        contains: containsText,
      }[overlap.relation]
      const text = fill(template, {
        label: overlap.label ?? overlap.cidr,
        cidr: overlap.cidr,
      })
      warnings.push({ key: `overlap-${overlap.cidr}`, icon: Layers, text })
    }
  }
  const setHostBits = ok && ok.hostBitsSet ? ok.address & ~ok.network : BigInt(0)

  return (
    <div data-slot="cidr-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={(event) => update(event.target.value.replace(/\s+/g, ""))}
        onBlur={(event) => {
          setSettled(text)
          onBlur?.(event)
        }}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${inputId}-hint`}
        data-warning={warnings.length && !invalid ? "" : undefined}
        data-danger={warnings.some((w) => w.danger) ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      {/* One cell per bit: network bits solid, host bits faint, host bits that are set in amber. */}
      <div aria-hidden className={cn("flex h-1.5 overflow-hidden rounded-full", fullBits === 32 && "gap-px")}>
        {Array.from({ length: fullBits }, (_, bit) => {
          const set = (setHostBits >> BigInt(fullBits - 1 - bit)) & BigInt(1)
          return (
            <span
              key={bit}
              className={cn(
                "flex-1 transition-colors duration-200 ease-out motion-reduce:transition-none",
                !ok ? "bg-muted" : bit < ok.prefix ? "bg-foreground/70" : set ? "bg-amber-500 dark:bg-amber-400" : "bg-muted",
                fullBits === 128 && bit % 16 === 15 && bit < 127 && "mr-px",
              )}
            />
          )
        })}
      </div>
      <div id={`${inputId}-hint`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {ok && (
          <p className="flex items-center gap-1.5 py-1 text-muted-foreground">
            <Network aria-hidden className="size-3.5 shrink-0" />
            <span className="min-w-0 font-mono wrap-anywhere">{fill(rangeText, values)}</span>
          </p>
        )}
        {invalid && (
          <p role="alert" className="flex items-center gap-1.5 py-1 text-destructive">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {invalid.error}
          </p>
        )}
        {warnings.map(({ key, icon: Icon, text, danger, fixes }) => (
          <p
            key={key}
            className={cn("flex gap-1.5", danger ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}
          >
            <span className="flex h-6 shrink-0 items-center">
              <Icon aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{text}</span>
              {fixes?.map((fix) => (
                <button key={fix} type="button" onClick={() => apply(fix)} aria-label={`Use ${fix}`} className={fixClass}>
                  {fix}
                </button>
              ))}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}
