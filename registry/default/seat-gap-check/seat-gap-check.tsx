"use client"

import * as React from "react"
import { Baby, MoveRight, TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkSeats, suggestBlock, type SeatIssue, type SeatRow, type Traveller } from "./seats"

export { checkSeats, parseSeatMap, suggestBlock, type Seat, type SeatIssue, type SeatRow, type SeatStatus, type SeatSuggestion, type Traveller } from "./seats"

/** Every visible string. Templates fill in `{count}`, `{seats}`, `{name}`, `{seat}`, `{label}` and `{status}`. */
export const SEAT_GAP_MESSAGES = {
  label: "Choose seats",
  front: "Screen",
  free: "free",
  taken: "taken",
  blocked: "not for sale",
  seatFor: "{seat}, {name}",
  seatState: "{seat}, {status}",
  remaining: "Pick {count} more.",
  remainingOne: "Pick 1 more.",
  full: "Everyone has a seat. Tap one to free it.",
  issues: {
    split: "Your group is split into {count} groups.",
    orphan: "This leaves {seats} empty on its own.",
    orphanMany: "This leaves {seats} empty, each on its own.",
    orphanBlocked: "This leaves {seats} empty on its own, which this venue doesn't allow.",
    orphanBlockedMany: "This leaves {seats} empty, each on its own, which this venue doesn't allow.",
    child: "{name} isn't next to an adult.",
  },
  rearrange: "Swap seats so {name} sits by an adult",
  move: "Move everyone to {label}",
  noBlock: "No block of {count} seats together is free.",
  summary: "{count} to fix with these seats.",
  summaryOne: "1 to fix with these seats.",
  legendFree: "Free",
  legendTaken: "Taken",
  legendYours: "Yours",
}

export type SeatGapMessages = typeof SEAT_GAP_MESSAGES

const fill = (template: string, values: Record<string, unknown>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] === undefined ? m : String(values[k])))
const initials = (name: string) => (name || "?").trim().slice(0, 1).toUpperCase()
const fixClass =
  "inline-flex min-h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md py-1 text-left border border-amber-500/40 px-3 text-sm font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface SeatGapCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** The seat map, front row first. `parseSeatMap` builds one from text. */
  rows: SeatRow[]
  /** Who needs a seat. Seats are given out in this order. */
  travellers: Traveller[]
  /** Controlled seats, one per traveller in the same order ("" for none yet). */
  value?: string[]
  /** Initial seats when uncontrolled. */
  defaultValue?: string[]
  /** Called with the seat for each traveller. */
  onValueChange?: (seats: string[]) => void
  /** Single empty seats: "warn" (default), "block" (the venue refuses them; say so) or "off" (flights, buses). */
  orphanRule?: "warn" | "block" | "off"
  /** Called whenever the open issues change, to gate checkout. */
  onIssuesChange?: (issues: SeatIssue[]) => void
  /** Pause in ms before the issue count is announced to screen readers. */
  delay?: number
  /** Any visible string; `issues` may be partial. Set `front` to "" to hide the screen bar. */
  messages?: Partial<Omit<SeatGapMessages, "issues">> & { issues?: Partial<SeatGapMessages["issues"]> }
}

/**
 * A seat map that checks the group's pick before checkout: seats split across the row, a single empty
 * seat left behind (which many venues refuse) and a child seated away from every adult. It marks the
 * problem seats and moves everyone to the nearest block that fits in one tap.
 */
export function SeatGapCheck({
  rows,
  travellers,
  value,
  defaultValue = [],
  onValueChange,
  orphanRule = "warn",
  onIssuesChange,
  delay = 500,
  messages,
  className,
  ...props
}: SeatGapCheckProps) {
  const t = { ...SEAT_GAP_MESSAGES, ...messages, issues: { ...SEAT_GAP_MESSAGES.issues, ...messages?.issues } }
  const safeRows = Array.isArray(rows) ? rows : []
  const people = Array.isArray(travellers) ? travellers : []
  const [inner, setInner] = React.useState(defaultValue)
  const seats = people.map((_, i) => (value ?? inner)?.[i] ?? "")
  const [focus, setFocus] = React.useState<string>()
  const [announcement, setAnnouncement] = React.useState("")
  const gridRef = React.useRef<HTMLDivElement>(null)
  const fixesRef = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef(false)
  const opts = { orphans: orphanRule !== "off" }
  const issues = checkSeats(safeRows, people, seats, opts)
  const suggestion = issues.length ? suggestBlock(safeRows, people, seats, opts) : null
  const flagged = new Set(issues.flatMap((i) => (i.kind === "orphan" ? i.seats : i.kind === "child" ? [i.seat] : [])))
  const owner = new Map(seats.map((s, i) => [s, i] as const).filter(([s]) => s))
  const left = seats.filter((s) => !s).length
  const issueKey = issues.map((i) => i.kind + JSON.stringify(i)).join("|")
  const summary = !issues.length ? "" : issues.length === 1 ? t.summaryOne : fill(t.summary, { count: issues.length })

  React.useEffect(() => onIssuesChange?.(issues), [issueKey]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(summary), delay)
    return () => clearTimeout(timer)
  }, [summary, delay])
  React.useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    const next = fixesRef.current?.querySelector<HTMLButtonElement>("button")
    ;(next ?? gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]'))?.focus()
  })

  const update = (next: string[], fromFix = false) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (fromFix) refocus.current = true
  }
  const toggle = (id: string) => {
    const mine = seats.indexOf(id)
    if (mine >= 0) return update(seats.map((s, i) => (i === mine ? "" : s)))
    const free = seats.indexOf("")
    if (free >= 0) update(seats.map((s, i) => (i === free ? id : s)))
  }

  const seatIds = safeRows.flatMap((r) => r.cells.filter((c) => c && c.status === "free").map((c) => c!.id))
  const tabStop = focus && seatIds.includes(focus) ? focus : (seats.find(Boolean) ?? seatIds[0])
  const move = (event: React.KeyboardEvent, row: number, col: number) => {
    const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key]
    let target: string | undefined
    if (step) {
      const [dr, dc] = step
      if (dr === 0) {
        const cells = safeRows[row].cells
        for (let c = col + dc; c >= 0 && c < cells.length && !target; c += dc) target = cells[c]?.status === "free" ? cells[c]?.id : undefined
      } else {
        for (let r = row + dr; r >= 0 && r < safeRows.length && !target; r += dr) {
          const cells = safeRows[r].cells
          target = [0, -1, 1, -2, 2].map((d) => cells[col + d]).find((x) => x?.status === "free")?.id
        }
      }
    } else if (event.key === "Home" || event.key === "End") {
      const free = safeRows[row].cells.filter((x) => x && x.status === "free")
      target = (event.key === "Home" ? free[0] : free[free.length - 1])?.id
    }
    if (!target) return
    event.preventDefault()
    setFocus(target)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-seat="${CSS.escape(target)}"]`)?.focus()
  }

  return (
    <div data-slot="seat-gap-check" className={cn("grid w-full max-w-md min-w-0 grid-cols-[minmax(0,1fr)] gap-3 text-sm", className)} {...props}>
      {t.front && <div aria-hidden className="mx-auto h-1.5 w-3/4 rounded-full bg-muted-foreground/30 text-center"><span className="relative -top-5 text-xs text-muted-foreground">{t.front}</span></div>}
      {/* Seats never shrink below 24px (WCAG 2.5.8); a wide map scrolls sideways instead. */}
      <div className="-m-1 min-w-0 overflow-x-auto overscroll-x-contain p-1">
      <div ref={gridRef} role="grid" aria-label={t.label} className="grid w-full min-w-min gap-1">
        {safeRows.map((r, row) => (
          <div key={r.label + row} role="row" className="grid min-w-0 items-center gap-1" style={{ gridTemplateColumns: `1rem ${r.cells.map((c) => (c ? "minmax(1.5rem,1.75rem)" : "0.75rem")).join(" ")}`, justifyContent: "safe center" }}>
            <span role="rowheader" className="text-xs text-muted-foreground">{r.label}</span>
            {r.cells.map((cell, col) => {
              if (!cell) return <span key={col} role="presentation" />
              const who = owner.get(cell.id)
              const traveller = who === undefined ? undefined : people[who]
              const label = traveller ? fill(t.seatFor, { seat: cell.id, name: traveller.name }) : fill(t.seatState, { seat: cell.id, status: t[cell.status] })
              return (
                <span key={cell.id} role="gridcell" className="min-w-0">
                  <button
                    type="button"
                    data-seat={cell.id}
                    tabIndex={cell.id === tabStop ? 0 : -1}
                    disabled={cell.status !== "free"}
                    aria-pressed={cell.status === "free" ? !!traveller : undefined}
                    aria-label={label}
                    title={label}
                    onClick={() => toggle(cell.id)}
                    onFocus={() => setFocus(cell.id)}
                    onKeyDown={(e) => move(e, row, col)}
                    className={cn(
                      "grid aspect-square w-full place-items-center rounded-t-md rounded-b-sm border text-[10px] font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      cell.status === "free" && !traveller && "bg-background hover:bg-accent dark:bg-input/30",
                      cell.status === "taken" && "border-transparent bg-muted-foreground/25",
                      cell.status === "blocked" && "border-dashed bg-transparent opacity-50",
                      traveller && "border-primary bg-primary text-primary-foreground",
                      flagged.has(cell.id) && "ring-2 ring-amber-500 ring-offset-1 ring-offset-background",
                    )}
                  >
                    {traveller ? (traveller.child ? <Baby aria-hidden className="size-3" /> : initials(traveller.name)) : null}
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>
      </div>
      <div aria-hidden className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm border bg-background" />{t.legendFree}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-muted-foreground/25" />{t.legendTaken}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-primary" />{t.legendYours}</span>
      </div>

      <p className="text-xs text-muted-foreground">{left > 1 ? fill(t.remaining, { count: left }) : left === 1 ? t.remainingOne : people.length ? t.full : ""}</p>

      {issues.length > 0 && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <ul className="grid gap-1 text-xs text-amber-700 dark:text-amber-400">
            {issues.map((issue) => (
              <li key={issue.kind + ("traveller" in issue ? issue.traveller : "")} className="flex gap-1.5">
                {issue.kind === "split" ? <Users aria-hidden className="mt-px size-3.5 shrink-0" /> : issue.kind === "child" ? <Baby aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
                <span className="min-w-0">
                  {issue.kind === "split" && fill(t.issues.split, { count: issue.groups.length })}
                  {issue.kind === "orphan" && fill(orphanRule === "block" ? (issue.seats.length > 1 ? t.issues.orphanBlockedMany : t.issues.orphanBlocked) : issue.seats.length > 1 ? t.issues.orphanMany : t.issues.orphan, { seats: issue.seats.join(", ") })}
                  {issue.kind === "child" && fill(t.issues.child, { name: people[issue.traveller]?.name })}
                </span>
              </li>
            ))}
          </ul>
          <div ref={fixesRef} className="flex min-w-0 flex-wrap gap-2">
            {issues.map((issue) =>
              issue.kind === "child" && issue.rearrange ? (
                <button key={`r${issue.traveller}`} type="button" onClick={() => update(issue.rearrange as string[], true)} className={fixClass}>
                  <span className="min-w-0">{fill(t.rearrange, { name: people[issue.traveller]?.name })}</span>
                </button>
              ) : null,
            )}
            {suggestion && !issues.every((i) => i.kind === "child" && i.rearrange) ? (
              <button type="button" onClick={() => update(suggestion.seats, true)} className={fixClass}>
                <MoveRight aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0">{fill(t.move, { label: suggestion.label })}</span>
              </button>
            ) : !suggestion ? (
              <p className="text-xs text-muted-foreground">{fill(t.noBlock, { count: people.length })}</p>
            ) : null}
          </div>
        </div>
      )}
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </div>
  )
}
