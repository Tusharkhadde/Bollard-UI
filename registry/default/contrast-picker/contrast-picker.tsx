"use client"

// Bollard UI — contrast-picker · MIT licence · https://bollard-ui.vercel.app/components/contrast-picker

import * as React from "react"
import { Check, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { contrastRatio, formatRatio, nearestPassing, parseHex, toHex, WCAG_THRESHOLDS } from "./contrast"

export { contrastRatio, formatRatio, luminance, nearestPassing, parseHex, toHex, WCAG_THRESHOLDS } from "./contrast"

export interface ColorPair {
  /** Text colour as hex. */
  foreground: string
  /** Background colour as hex. */
  background: string
}

export interface ContrastPickerProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Controlled pair. */
  value?: ColorPair
  /** Initial pair when uncontrolled. */
  defaultValue?: ColorPair
  /** Called with the pair on every change, including one-tap fixes. */
  onValueChange?: (value: ColorPair) => void
  /** WCAG level the warning and fixes aim for. */
  level?: "AA" | "AAA"
  /** Whether the pair is used for body text or large text (24px, or 18.66px bold). */
  textSize?: "normal" | "large"
  /** Label of the text colour. */
  foregroundLabel?: string
  /** Label of the background colour. */
  backgroundLabel?: string
  /** Short name of normal-size text in the badges. */
  bodyLabel?: string
  /** Short name of large text in the badges. */
  largeLabel?: string
  /** Sample text in the preview. */
  previewText?: string
  /** Builds the warning shown when the pair falls short. */
  failMessage?: (level: string, size: string, needed: number) => string
  /** Start of the fix buttons' accessible names ("Use #767676 for text"). */
  fixPrefix?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent pr-2 pl-9 font-mono text-base uppercase shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive"
const fixClass =
  "inline-flex h-6 items-center gap-1.5 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-contrast-picker-pop{0%{transform:scale(1.12)}100%{transform:scale(1)}}`

function ColorRow({ label, color, onChange }: { label: string; color: string; onChange: (hex: string) => void }) {
  const id = React.useId()
  const [draft, setDraft] = React.useState(color)
  const [prev, setPrev] = React.useState(color)
  if (color !== prev) {
    setPrev(color)
    setDraft(color)
  }
  const valid = parseHex(draft) !== null
  return (
    <div className="grid min-w-0 flex-1 gap-1.5">
      <label htmlFor={id} className="w-fit text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type="color"
          aria-label={`${label} colour`}
          value={toHex(parseHex(color) ?? [0, 0, 0])}
          onChange={(event) => onChange(event.target.value)}
          className="absolute top-1.5 left-1.5 z-10 size-6 cursor-pointer rounded-sm border bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          id={id}
          value={draft}
          spellCheck={false}
          maxLength={7}
          aria-invalid={valid ? undefined : true}
          onChange={(event) => {
            setDraft(event.target.value)
            const rgb = parseHex(event.target.value)
            if (rgb) onChange("#" + event.target.value.trim().replace(/^#/, "").toLowerCase().replace(/^(.)(.)(.)$/, "$1$1$2$2$3$3"))
          }}
          onBlur={() => setDraft(color)}
          className={fieldClass}
        />
      </div>
    </div>
  )
}

/**
 * A text/background colour pair picker that stops unreadable colour choices before they ship.
 * It shows the WCAG 2 contrast ratio truncated, never rounded up (#777 on white is 4.47:1 and
 * fails, though many tools print 4.5), marks AA and AAA for normal and large text, and offers
 * the nearest passing colour for either side in one tap, moving only lightness so the hue stays
 * on brand, and checking the result after rounding to hex.
 */
export function ContrastPicker({
  value,
  defaultValue = { foreground: "#777777", background: "#ffffff" },
  onValueChange,
  level = "AA",
  textSize = "normal",
  foregroundLabel = "Text",
  backgroundLabel = "Background",
  bodyLabel = "body",
  largeLabel = "large",
  previewText = "Your order has shipped",
  failMessage = (lvl, size, needed) => `Fails ${lvl} for ${size === "normal" ? "body" : "large"} text, which needs ${needed}:1.`,
  fixPrefix = "Use",
  className,
  ...props
}: ContrastPickerProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const pair = value ?? inner
  const fg = parseHex(pair.foreground) ?? [0, 0, 0]
  const bg = parseHex(pair.background) ?? [255, 255, 255]
  const ratio = contrastRatio(fg, bg)
  const needed = WCAG_THRESHOLDS[level][textSize]
  const fails = ratio < needed
  const fixes = fails
    ? ([
        ["foreground", foregroundLabel, nearestPassing(fg, bg, needed)],
        ["background", backgroundLabel, nearestPassing(bg, fg, needed)],
      ] as const).filter(([, , hex]) => hex)
    : []

  const update = (next: ColorPair) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const checks = (["AA", "AAA"] as const).flatMap((lvl) =>
    (["normal", "large"] as const).map((size) => ({ lvl, size, need: WCAG_THRESHOLDS[lvl][size], pass: ratio >= WCAG_THRESHOLDS[lvl][size] })),
  )

  return (
    <div data-slot="contrast-picker" className={cn("grid w-full max-w-sm gap-3", className)} {...props}>
      <style>{keyframes}</style>
      <div className="flex gap-3">
        <ColorRow label={foregroundLabel} color={pair.foreground} onChange={(foreground) => update({ ...pair, foreground })} />
        <ColorRow label={backgroundLabel} color={pair.background} onChange={(background) => update({ ...pair, background })} />
      </div>
      <div
        className="grid gap-1 rounded-lg border px-4 py-3 motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out"
        style={{ color: pair.foreground, backgroundColor: pair.background }}
      >
        <p className="text-base">{previewText}</p>
        <p className="text-2xl leading-tight font-semibold">{previewText}</p>
      </div>
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-2xl font-semibold tabular-nums" aria-label={`Contrast ratio ${formatRatio(ratio)} to 1`}>
          <span key={formatRatio(ratio)} className="inline-block motion-safe:animate-[cui-contrast-picker-pop_250ms_ease-out]">{formatRatio(ratio)}</span>
          <span className="text-base text-muted-foreground">:1</span>
        </p>
        <ul className="grid min-w-0 flex-1 grid-cols-2 gap-1 text-xs">
          {checks.map((c) => (
            <li
              key={c.lvl + c.size}
              className={cn(
                "flex items-center gap-0.5 rounded-md border px-1 py-1",
                c.pass ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 text-red-700 dark:text-red-400",
              )}
            >
              {c.pass ? <Check aria-hidden className="size-3.5 shrink-0" /> : <X aria-hidden className="size-3.5 shrink-0" />}
              <span className="font-medium">{c.lvl}</span>
              <span className="truncate text-muted-foreground">{c.size === "normal" ? bodyLabel : largeLabel}</span>
              <span className="sr-only">{c.pass ? "passes" : `fails, needs ${c.need}:1`}</span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-live="polite" className="-mt-1.5 min-h-6 text-xs">
        {fails ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{failMessage(level, textSize, needed)}</span>
              {fixes.map(([key, name, hex]) => (
                <button key={key} type="button" onClick={() => update({ ...pair, [key]: hex })} aria-label={`${fixPrefix} ${hex} for ${name.toLowerCase()}`} className={fixClass}>
                  <span aria-hidden className="size-3 rounded-sm border border-black/10 dark:border-white/20" style={{ backgroundColor: hex! }} />
                  {name} <span className="font-mono uppercase">{hex}</span>
                </button>
              ))}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
