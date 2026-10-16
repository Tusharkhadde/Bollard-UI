"use client"

// Bollard UI — size-fit-picker · MIT licence · https://bollard-ui.vercel.app/components/size-fit-picker

import * as React from "react"
import { Ruler, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { describeSize, findSize, findSizeTrap, MENS_SHOES, type SizeChart, type SizeRow, type SizeSystem } from "@/registry/default/size-fit-picker/sizes"

export * from "@/registry/default/size-fit-picker/sizes"

/** Every sentence the picker shows. Override any of them to reword or translate. */
export const SIZE_FIT_PICKER_MESSAGES = {
  legend: "Size",
  systemLabel: "Show sizes in",
  usual: (size: string, brand?: string) => `You usually buy ${size}${brand ? ` in ${brand}` : ""}.`,
  runs: (brand: string, offset: number, size: string) =>
    `${brand} runs ${offset > 0 ? "small" : "large"}, so ${size} is the closer fit.`,
  here: (size: string) => `That's ${size} here.`,
  pick: (size: string) => `Pick ${size}`,
  usualMarker: "your usual fit",
  soldOut: "sold out",
  trap: (picked: string, real: string, steps: number, smaller: boolean, usual: string) =>
    `You picked ${picked}, which is ${real}: ${steps === 1 ? "one size" : `${steps} sizes`} ${smaller ? "smaller" : "larger"} than your usual ${usual}.`,
  otherChart: (usual: string, theirs: string, cm: string, size: string) =>
    `Your usual ${usual} is for ${theirs}. By foot length (${cm}) that's about ${size} here.`,
  foot: (cm: string) => `${cm} foot`,
}

export interface SizeFitPickerProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** The size chart. Ships with MENS_SHOES, WOMENS_SHOES and WOMENS_CLOTHING. */
  chart?: SizeChart
  /** The selected size, written in `valueSystem` (what your stock uses). */
  value?: string | null
  /** Starting size when uncontrolled, in valueSystem. */
  defaultValue?: string | null
  /** Called with the size in `valueSystem` and its full row. */
  onValueChange?: (size: string, row: SizeRow) => void
  /** The system your SKUs and `value` use. Switching the shown system never changes the pick. */
  valueSystem?: SizeSystem
  /** The system the sizes are shown in, controlled. */
  system?: SizeSystem
  /** Initial shown system. Defaults to the shopper's usual system, then `valueSystem`. */
  defaultSystem?: SizeSystem
  /** Called when the shown size system changes. */
  onSystemChange?: (system: SizeSystem) => void
  /** Systems offered as tabs. */
  systems?: SizeSystem[]
  /** Sizes in stock, in `valueSystem`. Others show as sold out. Omit when everything is in stock. */
  available?: string[]
  /**
   * The shopper's remembered size, e.g. from past orders: `{ size: "8", system: "UK", brand: "Nike" }`.
   * Pass `chart` when it came from a different chart (men's vs women's) to convert it by foot length.
   */
  usual?: { size: string; system: SizeSystem; brand?: string; chart?: SizeChart }
  /** This product's brand, so a usual size from the same brand isn't adjusted. */
  brand?: string
  /** How this product fits compared with a usual size from another brand: 1 means size up one, -1 size down. */
  fitOffset?: number
  /** Reword or translate any sentence. */
  messages?: Partial<typeof SIZE_FIT_PICKER_MESSAGES>
}

const sizeClass =
  "relative flex min-h-11 flex-col items-center justify-center rounded-md border px-2 py-1 text-sm font-medium shadow-xs outline-none transition-[color,background-color,box-shadow] hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground aria-disabled:line-through aria-disabled:hover:bg-transparent dark:bg-input/30 dark:aria-checked:bg-primary"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A size picker that converts UK, US, EU and IN sizes live and keeps the pick when the
 * shown system changes. It reads back a remembered size ("You usually buy UK 8 in Nike")
 * adjusted for brands that run small or large, and catches the classic slip of clicking
 * your usual number in the wrong system, with a one-tap fix.
 */
export function SizeFitPicker({
  chart = MENS_SHOES,
  value,
  defaultValue = null,
  onValueChange,
  valueSystem = "UK",
  system: systemProp,
  defaultSystem,
  onSystemChange,
  systems: systemsProp = ["UK", "US", "EU", "IN"],
  available,
  usual,
  brand,
  fitOffset = 0,
  messages,
  className,
  ...props
}: SizeFitPickerProps) {
  const m = { ...SIZE_FIT_PICKER_MESSAGES, ...messages }
  const systems = systemsProp.filter((s) => chart.rows.some((row) => row.sizes[s]))
  const [innerSystem, setInnerSystem] = React.useState<SizeSystem>(defaultSystem ?? (usual && systems.includes(usual.system) ? usual.system : valueSystem))
  const [inner, setInner] = React.useState(defaultValue)
  const groupRef = React.useRef<HTMLDivElement>(null)
  const systemRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const system = systemProp ?? innerSystem
  const selected = value === undefined ? inner : value
  const picked = selected ? findSize(chart, valueSystem, selected) : -1

  const sameChart = !usual?.chart || usual.chart.id === chart.id
  // From another chart, the only honest bridge is foot length.
  const theirCm = usual?.chart && !sameChart ? usual.chart.rows[findSize(usual.chart, usual.system, usual.size)]?.cm : undefined
  const usualRow = !usual ? -1 : sameChart ? findSize(chart, usual.system, usual.size) : chart.rows.findIndex((row) => theirCm !== undefined && row.cm === theirCm)
  const offset = usual?.brand && brand && usual.brand === brand ? 0 : fitOffset
  const suggested = usualRow < 0 ? -1 : Math.min(chart.rows.length - 1, Math.max(0, usualRow + offset))
  const trap = usual && sameChart ? findSizeTrap(chart, system, picked, usual) : null
  const inStock = (row: SizeRow) => !available || available.includes(row.sizes[valueSystem] ?? "")
  const name = (row: SizeRow, s: SizeSystem) => (row.sizes[s] ? `${s} ${row.sizes[s]}` : row.label ?? "")

  const choose = (index: number) => {
    const row = chart.rows[index]
    const size = row?.sizes[valueSystem]
    if (!row || !size || !inStock(row)) return
    if (value === undefined) setInner(size)
    onValueChange?.(size, row)
  }

  const switchSystem = (next: SizeSystem) => {
    if (systemProp === undefined) setInnerSystem(next)
    onSystemChange?.(next)
  }

  // Radio-group keys: arrows move and select, Home/End jump to the ends.
  const keyStep = (key: string) => (key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0)

  const onSystemKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = keyStep(event.key)
    const next = event.key === "Home" ? 0 : event.key === "End" ? systems.length - 1 : step ? (index + step + systems.length) % systems.length : -1
    if (next < 0) return
    event.preventDefault()
    switchSystem(systems[next])
    systemRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const home = event.key === "Home"
    const end = event.key === "End"
    const step = home ? 1 : end ? -1 : keyStep(event.key)
    if (!step) return
    event.preventDefault()
    const start = home ? 0 : end ? chart.rows.length - 1 : index + step
    for (let i = start; i >= 0 && i < chart.rows.length; i += step) {
      if (!inStock(chart.rows[i])) continue
      choose(i)
      groupRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[i]?.focus()
      return
    }
  }

  const focusable = picked >= 0 ? picked : chart.rows.findIndex(inStock)
  const pickedRow = chart.rows[picked]
  // A letter size ("M") is the same word in every system; a number needs its system.
  const letter = !!usual && /^[a-z]+$/i.test(usual.size.trim())
  const usualName = !usual ? "" : letter ? usual.size.toUpperCase() : `${usual.system} ${usual.size}`
  const asUsual = (row: SizeRow) => (letter && row.label ? row.label : name(row, usual?.system ?? system))
  const fixRow = trap ? (suggested >= 0 && suggested !== picked ? suggested : trap.meant) : -1

  let hint: React.ReactNode = null
  if (usual && suggested >= 0) {
    const sugRow = chart.rows[suggested]
    hint = (
      <>
        {sameChart ? m.usual(usualName, usual.brand) : m.otherChart(usualName, usual.chart!.name, `${theirCm} cm`, asUsual(sugRow))}{" "}
        {offset !== 0 && brand && `${m.runs(brand, offset, asUsual(sugRow))} `}
        {system !== usual.system && m.here(name(sugRow, system))}
        {picked !== suggested && !trap && inStock(sugRow) && (
          <button type="button" onClick={() => choose(suggested)} className="ml-2 inline-flex h-6 items-center rounded-md border px-2 font-medium text-foreground transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {m.pick(name(sugRow, system))}
          </button>
        )}
      </>
    )
  }

  return (
    // The legend sits in a flex row, which drops it as the fieldset's name in some browsers, so it is wired up explicitly.
    <fieldset data-slot="size-fit-picker" className={cn("grid w-full min-w-0 max-w-sm gap-3", className)} aria-labelledby={`${id}-legend`} aria-describedby={`${id}-hint`} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend id={`${id}-legend`} className="float-left text-sm font-medium">{m.legend}</legend>
        <div ref={systemRef} role="radiogroup" aria-label={m.systemLabel} className="flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">
          {systems.map((s, i) => (
            <button key={s} type="button" role="radio" aria-checked={system === s} tabIndex={system === s || (i === 0 && !systems.includes(system)) ? 0 : -1} onClick={() => switchSystem(s)} onKeyDown={(event) => onSystemKeyDown(event, i)} className="h-7 rounded px-2.5 font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs">
              {s}
            </button>
          ))}
        </div>
      </div>

      <div ref={groupRef} role="radiogroup" aria-label={`${m.legend} (${system})`} className="grid grid-cols-4 gap-2">
        {chart.rows.map((row, i) => {
          const stock = inStock(row)
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked === i}
              aria-disabled={!stock || undefined}
              tabIndex={i === focusable ? 0 : -1}
              onClick={() => choose(i)}
              onKeyDown={(event) => onKeyDown(event, i)}
              aria-label={`${name(row, system)}${row.label ? ` (${row.label})` : ""}${i === suggested ? `, ${m.usualMarker}` : ""}${stock ? "" : `, ${m.soldOut}`}`}
              className={sizeClass}
            >
              <span className="tabular-nums">{row.sizes[system] ?? "—"}</span>
              {row.label && <span className="text-[11px] font-normal opacity-70">{row.label}</span>}
              {i === suggested && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-emerald-500" />}
            </button>
          )
        })}
      </div>

      <div id={`${id}-hint`} aria-live="polite" className="grid gap-1.5 text-xs">
        {pickedRow && (
          <p key={`${picked}-${system}`} className="flex items-center gap-1.5 text-muted-foreground">
            <Ruler aria-hidden className="size-3.5 shrink-0" />
            <span className="tabular-nums text-foreground">
              {describeSize(pickedRow, [system, ...systems.filter((s) => s !== system)])}
              {pickedRow.cm ? ` · ${m.foot(`${pickedRow.cm} cm`)}` : ""}
            </span>
          </p>
        )}
        {trap ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">
                {m.trap(name(pickedRow, system), name(pickedRow, usual!.system), Math.abs(trap.meant - trap.picked), trap.picked < trap.meant, usualName)}
              </span>
              {inStock(chart.rows[fixRow]) && (
                <button type="button" className={fixClass} onClick={() => choose(fixRow)}>{m.pick(name(chart.rows[fixRow], system))}</button>
              )}
            </span>
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </fieldset>
  )
}
