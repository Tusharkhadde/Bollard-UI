"use client"

import * as React from "react"
import { AtSign, Link2, Rows3, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { findFold, moveSentenceToStart, SURFACES, tightenOpening, URL_PATTERN, type FoldRule, type SurfaceId } from "./truncation"

export { findFold, SURFACES, type FoldRule, type SurfaceId } from "./truncation"

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, key: string) => v[key] ?? m)
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0])
const fieldClass =
  "w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** Renders text with the key point marked (green when seen, amber when hidden) and links underlined. */
function Marked({ text, offset, keyRange, seen }: { text: string; offset: number; keyRange?: [number, number]; seen: boolean }) {
  const cuts = new Set([0, text.length])
  const ranges: { from: number; to: number; kind: "key" | "url" }[] = []
  if (keyRange) ranges.push({ from: keyRange[0] - offset, to: keyRange[1] - offset, kind: "key" })
  for (const m of text.matchAll(URL_PATTERN)) ranges.push({ from: m.index, to: m.index + m[0].length, kind: "url" })
  for (const r of ranges) [r.from, r.to].forEach((x) => x > 0 && x < text.length && cuts.add(x))
  const points = [...cuts].sort((a, b) => a - b)
  return points.slice(0, -1).map((from, i) => {
    const piece = text.slice(from, points[i + 1])
    const kind = ranges.find((r) => from >= r.from && from < r.to)?.kind
    if (kind === "key") return <mark key={i} className={cn("rounded-sm px-px text-inherit", seen ? "bg-emerald-400/25" : "bg-amber-400/35")}>{piece}</mark>
    if (kind === "url") return <span key={i} className="text-sky-700 underline decoration-sky-700/40 dark:text-sky-400">{piece}</span>
    return <React.Fragment key={i}>{piece}</React.Fragment>
  })
}

export interface TruncationPreviewProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label of the text field. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called on every edit, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** The phrase readers must see before "…more", e.g. the offer or the date. */
  keyPoint?: string
  /** Starting key phrase when uncontrolled. */
  defaultKeyPoint?: string
  /** Called with the key phrase. */
  onKeyPointChange?: (value: string) => void
  /** Where the text will appear: built-in ids or your own rules. */
  surfaces?: (SurfaceId | FoldRule)[]
  /** Textarea rows. */
  rows?: number
  /** Templates: `{phrase}`, `{where}`, `{mention}`, `{count}`. */
  keyPointLabel?: string
  /** Warning when the key phrase is below the fold. */
  keyHiddenText?: string
  /** Warning when a link is below the fold. */
  linkHiddenText?: string
  /** Note about blank lines costing preview lines. */
  linesText?: string
  /** Warning about a leading @mention. */
  mentionText?: string
  /** Warning when the key phrase isn't in the text. */
  keyMissingText?: string
  /** Label of the move-sentence-up fix. */
  moveLabel?: string
  /** Label of the remove-blank-lines fix. */
  tightenLabel?: string
  /** Label for text below the fold. */
  hiddenLabel?: string
}

/**
 * Shows exactly where each feed cuts a post behind "…more" (LinkedIn, Instagram, X, push, Google) and
 * warns when the key point, a link or an @mention sits below that fold, with one-tap fixes: move that
 * sentence to the start, or drop the blank lines that each cost a whole line of the preview.
 */
export function TruncationPreview({
  label = "Post",
  value,
  defaultValue = "",
  onValueChange,
  keyPoint,
  defaultKeyPoint = "",
  onKeyPointChange,
  surfaces = ["linkedin-mobile", "linkedin-desktop", "instagram", "x", "push-ios", "push-android"],
  rows = 6,
  keyPointLabel = "Must be seen",
  keyHiddenText = "“{phrase}” is hidden behind “more” on {where}.",
  linkHiddenText = "The link is below the fold on {where}; few people expand a post to find it.",
  linesText = "Blank lines use up the preview on {where}: each costs a whole line.",
  mentionText = "{mention} comes after X's first 280 characters, so they won't be notified.",
  keyMissingText = "“{phrase}” isn't in the text yet.",
  moveLabel = "Move it to the start",
  tightenLabel = "Remove blank lines up top",
  hiddenLabel = "Hidden: {count} characters",
  id,
  className,
  ...props
}: TruncationPreviewProps) {
  const [innerText, setInnerText] = React.useState(defaultValue)
  const [innerKey, setInnerKey] = React.useState(defaultKeyPoint)
  const [active, setActive] = React.useState(0)
  const [measure, setMeasure] = React.useState<(text: string, font: string) => number>()
  const autoId = React.useId()
  const baseId = id ?? autoId
  const text = value ?? innerText
  const phrase = (keyPoint ?? innerKey).trim()

  React.useEffect(() => {
    const ctx = document.createElement("canvas").getContext("2d")
    if (ctx) setMeasure(() => (t: string, font: string) => ((ctx.font = font), ctx.measureText(t).width))
  }, [])

  const update = (next: string) => {
    if (value === undefined) setInnerText(next)
    onValueChange?.(next)
  }
  const updateKey = (next: string) => {
    if (keyPoint === undefined) setInnerKey(next)
    onKeyPointChange?.(next)
  }

  const keyAt = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1
  const keyRange: [number, number] | undefined = keyAt >= 0 ? [keyAt, keyAt + phrase.length] : undefined
  const linkAt = text.search(URL_PATTERN)
  const results = surfaces.map((s) => {
    const rule: FoldRule = typeof s === "string" ? SURFACES[s] : s
    const fold = findFold(text, rule, measure)
    return { rule, ...fold, keyHidden: !!keyRange && keyRange[1] > fold.cut, linkHidden: linkAt >= 0 && linkAt >= fold.cut }
  })
  const where = (pick: (r: (typeof results)[number]) => boolean) => results.filter(pick).map((r) => r.rule.label)
  const keyWhere = where((r) => r.keyHidden)
  const linkWhere = where((r) => r.linkHidden)
  const linesWhere = where((r) => r.hidden && r.blankLinesCost)
  const x = results.find((r) => r.rule.weighted)
  const lateMentions = x ? [...text.slice(x.cut).matchAll(/(^|\s)(@\w{1,15})/g)].map((m) => m[2]) : []
  const current = results[Math.min(active, results.length - 1)]
  const body = text.replace(/\s+$/, "")

  return (
    <div data-slot="truncation-preview" data-state={keyWhere.length || linkWhere.length ? "hidden" : "ok"} className={cn("grid w-full max-w-sm gap-3", className)} {...props}>
      <div className="grid gap-1.5">
        <label htmlFor={baseId} className="w-fit text-sm font-medium">{label}</label>
        <textarea id={baseId} rows={rows} value={text} onChange={(e) => update(e.target.value)} className={cn(fieldClass, "min-h-24 resize-y py-2")} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${baseId}-key`} className="w-fit text-sm font-medium">{keyPointLabel}</label>
        <input id={`${baseId}-key`} value={keyPoint ?? innerKey} onChange={(e) => updateKey(e.target.value)} className={cn(fieldClass, "h-9")} />
      </div>

      <div aria-live="polite" className="grid gap-1.5 text-xs empty:hidden">
        {[
          keyWhere.length > 0 && keyRange && { icon: TriangleAlert, text: fill(keyHiddenText, { phrase, where: list(keyWhere) }), fix: () => update(moveSentenceToStart(text, keyRange[0])), label: moveLabel },
          linkWhere.length > 0 && { icon: Link2, text: fill(linkHiddenText, { where: list(linkWhere) }), fix: () => update(moveSentenceToStart(text, linkAt)), label: moveLabel },
          linesWhere.length > 0 && { icon: Rows3, text: fill(linesText, { where: list(linesWhere) }), fix: () => update(tightenOpening(text, 400)), label: tightenLabel },
          lateMentions.length > 0 && { icon: AtSign, text: fill(mentionText, { mention: list(lateMentions) }) },
        ]
          .filter((w) => !!w)
          .concat(phrase && keyAt < 0 ? [{ icon: TriangleAlert, text: fill(keyMissingText, { phrase }), fix: undefined, label: undefined }] : [])
          .map(({ icon: Icon, text: message, fix, label: fixLabel }) => (
            <p key={message} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">{message}</span>
                {fix && <button type="button" onClick={fix} className={fixClass}>{fixLabel}</button>}
              </span>
            </p>
          ))}
      </div>

      <div className="grid gap-2">
        <div role="tablist" aria-label="Where it appears" className="flex flex-wrap gap-1.5">
          {results.map((r, i) => (
            <button
              key={r.rule.label}
              type="button"
              role="tab"
              id={`${baseId}-tab-${i}`}
              aria-selected={current === r}
              aria-controls={`${baseId}-panel`}
              tabIndex={current === r ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
                if (!step) return
                const next = (i + step + results.length) % results.length
                setActive(next)
                document.getElementById(`${baseId}-tab-${next}`)?.focus()
              }}
              className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:border-foreground aria-selected:bg-accent"
            >
              {(r.keyHidden || r.linkHidden) && <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />}
              {r.rule.label}
              {(r.keyHidden || r.linkHidden) && <span className="sr-only"> (something is hidden)</span>}
            </button>
          ))}
        </div>
        <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${results.indexOf(current)}`} className="overflow-hidden rounded-lg border bg-card text-sm text-card-foreground">
          <p key={`${current.rule.label}-${current.cut}`} className="px-3 pt-2.5 pb-2 break-words whitespace-pre-wrap motion-safe:animate-[cui-truncation-preview-in_200ms_ease-out]">
            <Marked text={body.slice(0, current.cut)} offset={0} keyRange={keyRange} seen />
            {current.hidden && <span className="font-medium text-muted-foreground">{current.rule.more}</span>}
          </p>
          {current.hidden && (
            <div className="border-t border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <p className="mb-1 font-medium">{fill(hiddenLabel, { count: String(body.length - current.cut) })}</p>
              <p className="line-clamp-3 break-words whitespace-pre-wrap opacity-70">
                <Marked text={body.slice(current.cut).trimStart()} offset={body.length - body.slice(current.cut).trimStart().length} keyRange={keyRange} seen={false} />
              </p>
            </div>
          )}
          <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">{current.rule.note}</p>
        </div>
      </div>
      <style>{"@keyframes cui-truncation-preview-in{from{opacity:.4}}"}</style>
    </div>
  )
}
