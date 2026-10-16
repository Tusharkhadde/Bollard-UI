"use client"

import * as React from "react"
import { Bot, Check, CopyX, Loader2, PenLine, Trash2, Undo2 } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { fillPlaceholder, findLeftovers, removeRanges, type Leftover, type LeftoverKind } from "./detect"

export { fillPlaceholder, findLeftovers, removeRanges, type Leftover, type LeftoverKind } from "./detect"

export const LEFTOVER_TEXT_CHECK_MESSAGES = {
  pasted: "That paste brought something in that shouldn't be published.",
  found: "{count} thing to fix before this goes out|{count} things to fix before this goes out",
  clear: "No chatbot chatter, placeholders or repeats left in.",
  kind: {
    refusal: "A chatbot refusal",
    chatter: "Chatbot chatter",
    placeholder: "Unfilled placeholder",
    marker: "Editing marker left in",
    duplicate: "Paragraph pasted twice",
  } satisfies Record<LeftoverKind, string>,
  copies: "{count} copy|{count} copies",
  remove: "Delete it",
  removeRepeat: "Delete the repeat",
  fill: "Fill in",
  fillLabel: "Replace every {token} with",
  fillApply: "Replace",
  show: "Show",
  undo: "Undo",
  removed: "Deleted.",
  filled: "Replaced {count} copy.|Replaced {count} copies.",
  more: "Show {count} more",
  publish: "Publish",
  publishAnyway: "Publish with {count} leftover|Publish with {count} leftovers",
  confirm: "Readers will see these as written. Press again to publish anyway.",
  publishing: "Publishing…",
}

type Messages = Omit<typeof LEFTOVER_TEXT_CHECK_MESSAGES, "kind"> & { kind: Record<LeftoverKind, string> }

export interface LeftoverTextCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change. */
  onValueChange?: (value: string) => void
  /** Publishes the text. May return a Promise; the button shows a pending state and can't fire twice. */
  onPublish?: (value: string) => void | Promise<void>
  /** Extra sentence patterns to treat as chatter, e.g. your own model's sign-off. */
  phrases?: RegExp[]
  /** Findings listed before a "Show N more" button. Default 4. */
  maxVisible?: number
  /** Flag a paragraph that appears twice. Default true. */
  duplicates?: boolean
  /** Class for the wrapper; `textareaClassName` styles the field itself. */
  className?: string
  /** Extra classes for the textarea. */
  textareaClassName?: string
  /** Override any visible string, including per-kind finding text. */
  messages?: Partial<Omit<Messages, "kind">> & { kind?: Partial<Record<LeftoverKind, string>> }
}

const fill = (t: string, v: Record<string, string | number>) =>
  (t.includes("|") ? t.split("|")[Number(v.count) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const chip =
  "inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
const ICON: Record<LeftoverKind, typeof Bot> = { refusal: Bot, chatter: Bot, placeholder: PenLine, marker: PenLine, duplicate: CopyX }

/** A short window of text around a range, with the leftover marked. */
function Snippet({ text, start, end }: { text: string; start: number; end: number }) {
  const from = Math.max(0, start - 32)
  const to = Math.min(text.length, end + 32)
  const body = text.slice(start, end)
  return (
    <span className="min-w-0 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
      {from > 0 && "…"}
      {text.slice(from, start).replace(/\s+/g, " ")}
      <mark className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30">{body.length > 120 ? `${body.slice(0, 118)}…` : body.replace(/\s+/g, " ")}</mark>
      {text.slice(end, to).replace(/\s+/g, " ")}
      {to < text.length && "…"}
    </span>
  )
}

/**
 * Stops text going out with the bits nobody meant to publish: chatbot chatter and refusals (Amazon
 * listings titled "I cannot fulfill that request"), unfilled placeholders ([product], [task 1], XX%),
 * TK and TODO, and a paragraph pasted twice, with no false alarms on [1], [sic] or Markdown links. It
 * flags them the moment they are pasted, deletes a chatter sentence in one tap, fills every copy of a
 * placeholder at once, and asks for a second press to publish with leftovers.
 */
export function LeftoverTextCheck({
  value: valueProp, defaultValue = "", onValueChange, onPublish, phrases, duplicates, maxVisible = 4, className, textareaClassName, messages,
  id: idProp, "aria-describedby": describedBy, onPaste, onBlur, ...props
}: LeftoverTextCheckProps) {
  const m: Messages = { ...LEFTOVER_TEXT_CHECK_MESSAGES, ...messages, kind: { ...LEFTOVER_TEXT_CHECK_MESSAGES.kind, ...messages?.kind } }
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  // What's been checked: updated at once on paste, blur or a fix, and after a pause while typing.
  const [checked, setChecked] = React.useState(value)
  const [pasted, setPasted] = React.useState(false)
  const [filling, setFilling] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  const [undo, setUndo] = React.useState<{ before: string; note: string } | null>(null)
  const [armed, setArmed] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const [all, setAll] = React.useState(false)
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const publishRef = React.useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()
  const auto = React.useId()
  const id = idProp ?? auto

  React.useEffect(() => {
    if (value === checked) return
    const t = setTimeout(() => setChecked(value), 900)
    return () => clearTimeout(t)
  }, [value, checked])

  const found = React.useMemo(() => findLeftovers(checked, { phrases, duplicates }), [checked, phrases, duplicates])
  const warn = armed && found.length > 0
  const summary = found.length ? fill(m.found, { count: found.length }) : m.clear

  React.useEffect(() => {
    const t = setTimeout(() => setStatus(checked.trim() ? summary : ""), 600)
    return () => clearTimeout(t)
  }, [summary, checked])

  const set = (next: string, now = false) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
    if (now) setChecked(next)
  }

  // After a fix, focus the next fix, or the field when none are left. Looked up by id so a card that is
  // animating out never takes focus.
  const focusNext = (next: string) => {
    const first = findLeftovers(next, { phrases, duplicates })[0]
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const button = first ? listRef.current?.querySelector<HTMLElement>(`[data-leftover="${CSS.escape(first.id)}"] button`) : null
        ;(button ?? fieldRef.current)?.focus()
      }),
    )
  }

  const apply = (next: string, note: string) => {
    setUndo({ before: value, note })
    set(next, true)
    setArmed(false)
    setFilling(null)
    focusNext(next)
  }

  // Ranges come from the last check; if typing has moved on since, find the same leftover in the live text.
  const fresh = (f: Leftover) =>
    value === checked ? f : findLeftovers(value, { phrases, duplicates }).find((x) => x.kind === f.kind && x.text === f.text) ?? null

  const remove = (f: Leftover) => {
    const live = fresh(f)
    if (live) apply(removeRanges(value, live.ranges), m.removed)
    else setChecked(value)
  }

  const select = (input: Leftover) => {
    const f = fresh(input)
    if (!f) return
    const el = fieldRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(f.ranges[0].start, f.ranges[0].end)
  }

  const publish = async () => {
    if (publishing) return
    const live = value === checked ? found : findLeftovers(value, { phrases, duplicates })
    setChecked(value)
    if (live.length && !armed) {
      setArmed(true)
      if (!reduce && publishRef.current) animate(publishRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
      return
    }
    setPublishing(true)
    try {
      await onPublish?.(value)
    } catch {
      // The caller reports its own failure; the button becomes usable again.
    } finally {
      setPublishing(false)
      setArmed(false)
    }
  }

  return (
    <div data-slot="leftover-text-check" data-state={found.length ? "found" : "clear"} className={cn("grid w-full min-w-0 gap-2", className)}>
      <textarea
        ref={fieldRef}
        id={id}
        value={value}
        aria-invalid={found.length > 0 || undefined}
        aria-describedby={[describedBy, found.length ? `${id}-summary` : null].filter(Boolean).join(" ") || undefined}
        onChange={(e) => {
          set(e.target.value)
          setPasted(false)
          setUndo(null)
        }}
        onPaste={(e) => {
          onPaste?.(e)
          // Check right after the paste lands, not after the typing pause.
          requestAnimationFrame(() => {
            const next = fieldRef.current?.value ?? ""
            setChecked(next)
            setPasted(findLeftovers(next, { phrases, duplicates }).length > 0)
          })
        }}
        onBlur={(e) => {
          onBlur?.(e)
          setChecked(e.currentTarget.value)
        }}
        rows={8}
        className={cn(
          "min-h-32 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-amber-500/60 md:text-sm dark:bg-input/30",
          textareaClassName,
        )}
        {...props}
      />

      {checked.trim() && (
        <p id={`${id}-summary`} className={cn("text-xs", found.length ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {pasted && found.length ? m.pasted : summary}
        </p>
      )}

      {found.length > 0 && (
        <ul ref={listRef} className="grid gap-1.5">
          <AnimatePresence initial={false}>
            {(all ? found : found.slice(0, Math.max(1, maxVisible))).map((f, i) => {
              const Icon = ICON[f.kind]
              const fillable = f.kind === "placeholder"
              return (
                <motion.li
                  key={f.id}
                  data-leftover={f.id}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: reduce ? 0 : Math.min(i, 5) * 0.04 } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className={cn(
                    "grid min-w-0 gap-1.5 rounded-md border p-2.5",
                    f.kind === "refusal" ? "border-red-500/40 bg-red-500/5 dark:bg-red-500/10" : "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", f.kind === "refusal" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-medium">
                        {m.kind[f.kind]}
                        {fillable && (
                          <>
                            {" "}
                            <code className="rounded-sm bg-background px-1 font-mono text-xs">{f.text}</code>
                            {f.ranges.length > 1 && <span className="font-normal text-muted-foreground"> · {fill(m.copies, { count: f.ranges.length })}</span>}
                          </>
                        )}
                      </span>
                      <Snippet text={checked} start={f.ranges[0].start} end={f.ranges[0].end} />
                    </div>
                  </div>

                  {filling === f.id ? (
                    <form
                      className="flex flex-wrap items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (draft.trim()) apply(fillPlaceholder(value, f.text, draft.trim()), fill(m.filled, { count: f.ranges.length }))
                      }}
                    >
                      <label htmlFor={`${id}-fill`} className="sr-only">
                        {fill(m.fillLabel, { token: f.text })}
                      </label>
                      <input
                        id={`${id}-fill`}
                        autoFocus
                        value={draft}
                        placeholder={f.text.replace(/^[[{<]|[\]}>]$/g, "")}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setFilling(null)
                            requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(f.id)}"]`)?.focus())
                          }
                        }}
                        className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                      />
                      <button type="submit" disabled={!draft.trim()} className={cn(chip, "h-8")}>
                        {m.fillApply}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {fillable ? (
                        <button
                          type="button"
                          data-fix
                          data-id={f.id}
                          onClick={() => {
                            setDraft("")
                            setFilling(f.id)
                          }}
                          className={chip}
                        >
                          <PenLine aria-hidden className="size-3.5" />
                          {m.fill}
                        </button>
                      ) : f.kind !== "marker" ? (
                        <button type="button" data-fix data-id={f.id} onClick={() => remove(f)} className={chip}>
                          <Trash2 aria-hidden className="size-3.5" />
                          {f.kind === "duplicate" ? m.removeRepeat : m.remove}
                        </button>
                      ) : null}
                      <button type="button" data-fix={f.kind === "marker" ? "" : undefined} onClick={() => select(f)} className={chip}>
                        {m.show}
                      </button>
                    </div>
                  )}
                </motion.li>
              )
            })}
          </AnimatePresence>
          {!all && found.length > Math.max(1, maxVisible) && (
            <li>
              <button type="button" onClick={() => setAll(true)} className={chip}>
                {fill(m.more, { count: found.length - Math.max(1, maxVisible) })}
              </button>
            </li>
          )}
        </ul>
      )}

      <AnimatePresence initial={false}>
        {undo && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {undo.note}
            <button
              type="button"
              onClick={() => {
                set(undo.before, true)
                setUndo(null)
                requestAnimationFrame(() => fieldRef.current?.focus())
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Undo2 aria-hidden className="size-3.5" />
              {m.undo}
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      {onPublish && (
        <div className="grid gap-1.5">
          <button
            ref={publishRef}
            type="button"
            disabled={publishing}
            aria-describedby={warn ? `${id}-confirm` : undefined}
            onClick={publish}
            className={cn(
              "inline-flex h-9 w-fit max-w-full items-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              warn ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {publishing && <Loader2 aria-hidden className="size-4 animate-spin" />}
            <span className="truncate">{publishing ? m.publishing : warn ? fill(m.publishAnyway, { count: found.length }) : m.publish}</span>
          </button>
          {warn && (
            <p id={`${id}-confirm`} role="alert" className="text-xs text-amber-700 dark:text-amber-400">
              {m.confirm}
            </p>
          )}
        </div>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
