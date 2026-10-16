"use client"

import * as React from "react"
import { CircleCheck, Download, History, LoaderCircle, Trash2, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

type When = Date | number | string
const DAY = 86_400_000

export interface RetentionDay {
  /** Calendar day in UTC, "YYYY-MM-DD". */
  date: string
  /** Records stored for that day. */
  count: number
}

/**
 * What a retention period deletes at the next purge: records from days before
 * the cutoff, the cutoff itself, and roughly how many more go each night after.
 */
export function retentionImpact(history: RetentionDay[], days: number, purgeAt: When) {
  const cutoff = new Date(new Date(purgeAt).getTime() - days * DAY)
  const cutoffDay = cutoff.toISOString().slice(0, 10)
  const deleted = history.filter((d) => d.date < cutoffDay)
  return {
    cutoff,
    deletedCount: deleted.reduce((n, d) => n + d.count, 0),
    deletedDays: deleted.length,
    nextNight: history.find((d) => d.date === cutoffDay)?.count ?? 0,
  }
}

/** Groups days into at most `max` bars so a year of history still fits a phone. */
const bars = (history: RetentionDay[], max: number) => {
  const size = Math.ceil(history.length / max) || 1
  return Array.from({ length: Math.ceil(history.length / size) }, (_, i) => {
    const slice = history.slice(i * size, i * size + size)
    return { date: slice[slice.length - 1].date, count: slice.reduce((n, d) => n + d.count, 0) }
  })
}

/** When the purge runs, relative to now: in the next 24 hours (tonight or today) or later. */
export type PurgeWhen = "tonight" | "today" | "later"

/** Every user-visible string. Counts and dates arrive already formatted for the locale. */
export const RETENTION_CHANGE_MESSAGES = {
  legend: (noun: string) => `Keep ${noun} for`,
  option: (days: number) => (days % 365 === 0 ? `${days / 365} year${days > 365 ? "s" : ""}` : `${days} day${days === 1 ? "" : "s"}`),
  current: "(current)",
  chartEnd: "Today",
  when: (when: PurgeWhen, time: string, date: string) => (when === "later" ? `on ${date} at ${time}` : `${when} at ${time}`),
  timeLeft: (hours: number, minutes: number) => (hours ? `${hours} h ${minutes} min` : `${minutes} min`),
  deletes: (count: string, noun: string) => `deletes ${count} ${noun}`,
  /** `deletes` is the bold part, already built from `deletes` above. */
  lowering: (period: string, deletes: React.ReactNode, cutoff: string, when: string): React.ReactNode => (
    <>Lowering to {period} {deletes} older than {cutoff}, {when}.</>
  ),
  nextNight: (count: string, _noun: string) => `After that, about ${count} more each night.`,
  undo: (left: string) => `Nothing is deleted until the purge in ${left}. Change it back before then and nothing is lost.`,
  raise: (period: string, noun: string) => `Keeps ${noun} for ${period} from now on. It can’t bring back ${noun} already deleted.`,
  nothingOld: (noun: string) => `No existing ${noun} are old enough to be deleted.`,
  exportFirst: (count: string, noun: string) => `Export ${count} ${noun} first`,
  exported: "Exported",
  save: "Save",
  deleteWithoutExport: "Delete without export",
  deleteNow: (count: string, noun: string, when: PurgeWhen) => `Delete ${count} ${noun} ${when === "later" ? "at purge" : when}`,
}
export type RetentionChangeMessages = typeof RETENTION_CHANGE_MESSAGES

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

export interface RetentionChangeProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "title"> {
  /** Retention in force today, in days. */
  current: number
  /** New retention in days. Controlled. */
  value?: number
  defaultValue?: number
  onValueChange?: (days: number) => void
  /** Periods to offer, in days. */
  options?: number[]
  /** Records per day, oldest first. */
  history: RetentionDay[]
  /** When the next purge job runs. */
  purgeAt: When
  /** Plural noun for the data, e.g. "events". */
  noun?: string
  /** Exports everything older than the cutoff. Shows "Export first" when given. */
  onExport?: (olderThan: Date) => void | Promise<void>
  /** Saves the new period. A returned promise shows a pending state; a rejection is caught. */
  onConfirm: (days: number) => void | Promise<void>
  /** BCP 47 locale for numbers and dates. */
  locale?: string
  /** IANA zone for the purge time and dates, e.g. the workspace's zone. Defaults to the viewer's. */
  timeZone?: string
  /** Every visible string (see `RETENTION_CHANGE_MESSAGES`). The single-string props below still work and win. */
  messages?: Partial<RetentionChangeMessages>
  /** @deprecated Use `messages.option`. */
  optionLabel?: (days: number) => string
  /** @deprecated Use `messages.undo`. */
  undoText?: (left: string) => string
  /** @deprecated Use `messages.raise`. */
  raiseText?: (days: string) => string
}

/**
 * The retention setting that says exactly what a shorter period destroys and
 * when: "Lowering to 30 days deletes 14,210 events older than 13 Sep, tonight
 * at 02:00", with a chart that shades the doomed days, a countdown to the purge
 * while changing it back still loses nothing, and an export-first step that
 * the confirm button names until it is done.
 */
export function RetentionChange({
  current,
  value,
  defaultValue = current,
  onValueChange,
  options = [7, 30, 90, 365],
  history,
  purgeAt,
  noun = "records",
  onExport,
  onConfirm,
  locale = "en-GB",
  timeZone,
  messages,
  optionLabel,
  undoText,
  raiseText,
  className,
  ...props
}: RetentionChangeProps) {
  const t: RetentionChangeMessages = {
    ...RETENTION_CHANGE_MESSAGES,
    ...messages,
    ...(optionLabel && { option: optionLabel }),
    ...(undoText && { undo: undoText }),
    ...(raiseText && { raise: (period: string) => raiseText(period) }),
  }
  const [inner, setInner] = React.useState(defaultValue)
  const [now, setNow] = React.useState(0)
  const [exported, setExported] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState<"export" | "save" | null>(null)
  const baseId = React.useId()
  const days = value ?? inner
  const purge = new Date(purgeAt).getTime()
  const impact = retentionImpact(history, days, purge)
  const lowering = days < current && impact.deletedCount > 0
  const chart = bars(history, 60)
  const peak = Math.max(...chart.map((b) => b.count), 1)
  const cutoffAt = chart.findIndex((b) => b.date >= impact.cutoff.toISOString().slice(0, 10))
  const split = cutoffAt < 0 ? 100 : (cutoffAt / chart.length) * 100

  React.useEffect(() => {
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])

  const num = (n: number) => n.toLocaleString(locale)
  const date = (t: When) => new Date(t).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone })
  const time = new Date(purge).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone })
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(purge))
  const whenKind: PurgeWhen = purge - now >= DAY ? "later" : hour < 6 || hour >= 18 ? "tonight" : "today"
  const when = t.when(whenKind, time, date(purge))
  const left = Math.max(0, purge - now)
  const minutesLeft = Math.round(left / 60_000)
  const leftText = t.timeLeft(Math.floor(minutesLeft / 60), minutesLeft % 60)

  const setDays = (d: number) => {
    if (value === undefined) setInner(d)
    onValueChange?.(d)
  }
  const act = async (kind: "export" | "save") => {
    if (busy) return
    setBusy(kind)
    try {
      if (kind === "export") {
        await onExport?.(impact.cutoff)
        setExported(days)
      } else await onConfirm(days)
    } catch {
      // The caller reports the error; nothing changes here.
    } finally {
      setBusy(null)
    }
  }
  const isExported = exported !== null && exported <= days

  return (
    <section
      data-slot="retention-change"
      aria-labelledby={`${baseId}-title`}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <style>{"@keyframes cui-retention-change-in{from{opacity:.4;transform:translateY(-2px)}}"}</style>
      <fieldset className="space-y-1.5">
        <legend id={`${baseId}-title`} className="mb-1.5 flex items-center gap-2 font-medium">
          <History aria-hidden className="size-4 shrink-0 text-muted-foreground" /> {t.legend(noun)}
        </legend>
        <div className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
          {options.map((d) => (
            <label key={d} className="relative flex h-7 cursor-pointer items-center justify-center rounded-md text-xs whitespace-nowrap font-medium text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
              <input type="radio" name={`${baseId}-days`} checked={days === d} onChange={() => setDays(d)} className="sr-only" />
              {t.option(d)}
              {d === current && (
                <>
                  <span className="sr-only"> {t.current}</span>
                  <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-current opacity-60" />
                </>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <figure aria-hidden className="space-y-1">
        <div className="relative flex h-16 items-end gap-px">
          {chart.map((b, i) => (
            <div
              key={b.date}
              className={cn("flex-1 rounded-t-[1px] transition-colors duration-300", lowering && i < cutoffAt ? "bg-red-500/70 dark:bg-red-400/70" : "bg-muted-foreground/30")}
              style={{ height: `${Math.max(4, (b.count / peak) * 100)}%` }}
            />
          ))}
          {lowering && (
            <div className="absolute inset-y-0 border-l-2 border-dashed border-red-600 motion-safe:transition-[left] motion-safe:duration-300 motion-safe:ease-out dark:border-red-400" style={{ left: `${split}%` }} />
          )}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{now ? date(history[0]?.date ?? purge) : ""}</span>
          <span>{t.chartEnd}</span>
        </div>
      </figure>

      <div aria-live="polite">
      <div key={days} className="space-y-1.5 text-sm motion-safe:animate-[cui-retention-change-in_200ms_ease-out]">
        {!now ? null : lowering ? (
          <>
            <p className="flex gap-2">
              <Trash2 aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>
                {t.lowering(t.option(days), <strong className="font-semibold">{t.deletes(num(impact.deletedCount), noun)}</strong>, date(impact.cutoff), when)}{" "}
                {impact.nextNight > 0 && <span className="text-muted-foreground">{t.nextNight(num(impact.nextNight), noun)}</span>}
              </span>
            </p>
            {left > 0 && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Undo2 aria-hidden className="mt-px size-3.5 shrink-0" /> {t.undo(leftText)}
              </p>
            )}
          </>
        ) : days > current ? (
          <p className="text-muted-foreground">{t.raise(t.option(days), noun)}</p>
        ) : days !== current ? (
          <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-4 shrink-0" /> {t.nothingOld(noun)}
          </p>
        ) : null}
      </div>
      </div>

      {days !== current && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {lowering && onExport && (
            <button type="button" disabled={isExported || !!busy} aria-busy={busy === "export" || undefined} onClick={() => void act("export")} className={cn(button, outline)}>
              {busy === "export" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : isExported ? <CircleCheck aria-hidden className="size-4 text-emerald-600" /> : <Download aria-hidden className="size-4" />}
              {isExported ? t.exported : t.exportFirst(num(impact.deletedCount), noun)}
            </button>
          )}
          <button
            type="button"
            aria-busy={busy === "save" || undefined}
            onClick={() => void act("save")}
            className={cn(button, lowering ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70" : "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            {busy === "save" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {!lowering ? t.save : onExport && !isExported ? t.deleteWithoutExport : t.deleteNow(num(impact.deletedCount), noun, whenKind)}
          </button>
        </div>
      )}
    </section>
  )
}
