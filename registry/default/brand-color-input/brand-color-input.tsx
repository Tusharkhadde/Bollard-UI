"use client"

// Bollard UI — brand-color-input · MIT licence · https://bollard-ui.vercel.app/components/brand-color-input

import * as React from "react"
import { Check, Pipette } from "lucide-react"

import { cn } from "@/lib/utils"
import { readColor, SAME_COLOR, type ColorIssue, type ColorReading } from "./color"

export { cleanColor, colorDistance, NEAR_COLOR, nearestToken, readColor, SAME_COLOR, toHex, toOklab, type ColorIssue, type ColorReading, type RGBA } from "./color"

/** Every sentence the field can show. `i` is the issue, `r` the whole reading. */
export const BRAND_COLOR_MESSAGES = {
  unreadable: () => "Not a colour this field can read. Use hex (#1e40af) or rgb(30 64 175).",
  stray: (i: ColorIssue) => `Extra characters around the colour. It reads as ${i.fix}.`,
  lookalike: () => "That's a letter O or l, not a zero or one. Hex only uses 0–9 and A–F.",
  digits: (i: ColorIssue) =>
    `${i.detail} digits isn't a hex colour (it needs 3, 4, 6 or 8).${i.token ? ` One digit away from ${i.token}.` : ""}`,
  argb: (i: ColorIssue) =>
    `Alpha comes first here, like Android's #AARRGGBB. CSS reads alpha last and would show ${i.detail}.`,
  "short-alpha": (i: ColorIssue) => `A 4th digit is alpha: this renders as ${i.detail}, partly see-through.`,
  transparent: () => "Alpha is 00, so this colour is fully transparent.",
  "alpha-range": (i: ColorIssue) => `Alpha ${i.detail} is out of range. CSS wants 0–1 or a percentage.`,
  "out-of-range": () => "A channel is outside 0–255 and will be clamped.",
  near: (i: ColorIssue, r: ColorReading) =>
    (r.nearest?.distance ?? 1) < SAME_COLOR
      ? `Looks identical to ${i.token}, but isn't the same value.`
      : `Close to ${i.token}, but not the brand value.`,
  exact: (r: ColorReading) => `Matches ${r.nearest?.token}.`,
  nearest: (r: ColorReading) => `Not a brand colour. Nearest is ${r.nearest?.token} (${r.nearest?.hex}).`,
}

export interface BrandColorInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Called with the canonical hex the text renders as, or null when it can't be read. */
  onColorChange?: (hex: string | null) => void
  /** Brand tokens by name, e.g. { "blue-700": "#1e40af" }. */
  palette?: Record<string, string>
  /** Override any message. */
  messages?: Partial<typeof BRAND_COLOR_MESSAGES>
  /** Label of the one-tap fix that snaps to a token ("Use blue-700"). */
  snapLabel?: string
  /** Label of the other one-tap fixes. */
  fixLabel?: string
}

const NO_PALETTE: Record<string, string> = {}
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent pr-3 pl-10 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1.5 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
// Checkerboard under the swatch so alpha is visible instead of silently blending into the page.
const checker = "bg-[conic-gradient(#ccc_25%,#fff_0_50%,#ccc_0_75%,#fff_0)] bg-[length:8px_8px]"

function Swatch({ color, className }: { color: string | null; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block overflow-hidden rounded-sm border", checker, className)}>
      <span className="absolute inset-0" style={{ background: color ?? "transparent" }} />
    </span>
  )
}

/** The fixed hex with the digits that change marked, so a one-digit slip is obvious. */
function Diff({ typed, fix }: { typed: string; fix: string }) {
  const t = typed.replace(/^#/, "").toLowerCase()
  return (
    <span className="font-mono">
      #
      {Array.from(fix.replace(/^#/, "")).map((d, i) => (
        <span key={i} className={cn(d.toLowerCase() !== t[i] && "rounded-sm bg-amber-300/50 dark:bg-amber-400/25")}>
          {d}
        </span>
      ))}
    </span>
  )
}

/**
 * A colour field that stops near-miss brand colours from shipping. It names the closest token from
 * `palette` and offers a one-tap snap when a value is a hair off (#1e40ae vs the brand's #1e40af),
 * and catches pasted junk (`color: #1E40AF;`), the letter O for zero, a digit too many or few, alpha
 * hidden in 4- and 8-digit hex, and Android's #AARRGGBB order that CSS reads as a different colour.
 */
export function BrandColorInput({
  label = "Colour",
  value,
  defaultValue = "",
  onValueChange,
  onColorChange,
  palette = NO_PALETTE,
  messages,
  snapLabel = "Use",
  fixLabel = "Fix to",
  id,
  className,
  ref,
  ...props
}: BrandColorInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const inputRef = React.useRef<HTMLInputElement>(null)
  const swatchRef = React.useRef<HTMLSpanElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const m = { ...BRAND_COLOR_MESSAGES, ...messages }

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const reading = React.useMemo(() => readColor(text, palette), [text, palette])
  const issue = reading.issues[0]
  const lastHex = React.useRef<string | null | undefined>(undefined)
  React.useEffect(() => {
    if (lastHex.current !== reading.hex) onColorChange?.(reading.hex)
    lastHex.current = reading.hex
  }, [reading.hex, onColorChange])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const apply = (fix: string) => {
    update(fix)
    inputRef.current?.focus()
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      swatchRef.current?.animate([{ transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" })
    }
  }

  const message = issue ? (issue.kind === "near" ? m.near(issue, reading) : m[issue.kind](issue)) : null

  return (
    <div data-slot="brand-color-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <span ref={swatchRef} className="absolute top-1.5 left-1.5 flex">
          <Swatch color={reading.hex} className="size-6" />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          value={text}
          onChange={(event) => update(event.target.value)}
          aria-describedby={hintId}
          aria-invalid={issue?.kind === "unreadable" || (issue?.kind === "digits" && !issue.fix) || undefined}
          data-warning={issue && issue.kind !== "unreadable" ? "" : undefined}
          className={fieldClass}
          {...props}
        />
      </div>
      <div id={hintId} aria-live="polite" className="min-h-6 text-xs">
        {issue ? (
          <div className={cn("flex gap-1.5", issue.kind === "unreadable" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
            <span className="flex h-6 shrink-0 items-center">
              <Pipette aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{message}</span>
              {issue.fix ? (
                <button
                  type="button"
                  onClick={() => apply(issue.fix!)}
                  aria-label={issue.token ? `${snapLabel} ${issue.token} ${issue.fix}` : `${fixLabel} ${issue.fix}`}
                  className={fixClass}
                >
                  {issue.kind === "near" && (
                    <span className="flex">
                      <Swatch color={reading.hex} className="h-3.5 w-2 rounded-r-none border-r-0" />
                      <Swatch color={issue.fix} className="h-3.5 w-2 rounded-l-none border-l-0" />
                    </span>
                  )}
                  {issue.token ? `${snapLabel} ${issue.token}` : fixLabel}
                  {issue.kind === "near" || issue.kind === "digits" || issue.kind === "lookalike" ? (
                    <Diff typed={issue.kind === "near" ? (reading.hex ?? text) : text} fix={issue.fix} />
                  ) : (
                    <span className="font-mono">{issue.fix}</span>
                  )}
                </button>
              ) : null}
            </span>
          </div>
        ) : reading.nearest && reading.rgba ? (
          <p className="flex gap-1.5 text-muted-foreground">
            <span className="flex h-6 shrink-0 items-center">
              {reading.nearest.exact ? (
                <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Swatch color={reading.nearest.hex} className="size-3.5" />
              )}
            </span>
            <span className="py-1">{reading.nearest.exact ? m.exact(reading) : m.nearest(reading)}</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
