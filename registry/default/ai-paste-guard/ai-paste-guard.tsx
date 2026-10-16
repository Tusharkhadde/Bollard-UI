"use client"

import * as React from "react"
import { EyeOff, ShieldAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { decodeTagCharacters, scanPaste, type HiddenKind, type PasteScan } from "./paste-scan"

export { decodeTagCharacters, findInjection, scanPaste, type HiddenKind, type HiddenPassage, type PasteScan } from "./paste-scan"

/** Every visible string. `{count}` is filled in. */
export const AI_PASTE_MESSAGES = {
  label: "Message",
  heldTitle: "This paste carries {count} passages you can't see",
  heldTitleOne: "This paste carries a passage you can't see",
  injectionTitle: "This paste hides instructions aimed at the AI",
  intro: "It was copied as rich text. The AI reads everything below; you only saw the visible part.",
  kinds: {
    comment: "HTML comment",
    display: "Hidden element (display: none)",
    transparent: "Transparent text",
    tiny: "Zero-size text",
    "same-color": "Text the same colour as its background",
    offscreen: "Positioned off-screen",
    clipped: "Clipped to nothing",
    attribute: "Image or link text",
    tags: "Invisible tag characters",
  } as Record<HiddenKind, string>,
  reaches: "Pastes as text",
  injection: "Reads like an instruction",
  visibleOnly: "Paste visible text only",
  everything: "Paste everything",
  cancel: "Cancel",
  pastedVisible: "Pasted the visible text. Left out {count} hidden passages.",
  pastedAll: "Pasted everything, hidden text included.",
  undo: "Undo",
  held: "Paste held: {count} hidden passages found.",
}

export type AiPasteMessages = typeof AI_PASTE_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/** A clipboard payload: the text/html and text/plain flavours. */
export interface ClipboardSample {
  html?: string
  text?: string
}

export interface AiPasteGuardProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue"> {
  /** Visible label. */
  label?: string
  /** Controlled prompt text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including pastes. */
  onValueChange?: (text: string) => void
  /** A paste to review on mount, e.g. one captured from a drop or share target. */
  review?: ClipboardSample
  /**
   * Background colour of the page text is usually copied from, for spotting same-colour text. By default it's white,
   * or dark when most of the pasted text is light (a copy from a dark-mode page), so light text isn't flagged there.
   */
  sourceBackground?: string
  /** Any visible string; `kinds` may be partial. */
  messages?: Partial<Omit<AiPasteMessages, "kinds">> & { kinds?: Partial<AiPasteMessages["kinds"]> }
  /** Class for the outer wrapper. */
  className?: string
}

type Held = { scan: PasteScan; plain: string; start: number; end: number }

/**
 * Stops hidden prompt injections riding in on a paste. When rich text is pasted into an AI prompt box it reads the
 * HTML clipboard flavour, holds the paste if anything in it was invisible to the person copying it (white or
 * zero-size text, comments, off-screen elements, alt text with instructions, Unicode tag-character payloads), shows
 * that text with injection phrasing marked, and offers to paste only what they could see.
 */
export function AiPasteGuard({ label, value, defaultValue = "", onValueChange, review, sourceBackground, messages, className, id, rows = 4, onPaste, onKeyDown, ref, "aria-describedby": describedBy, ...props }: AiPasteGuardProps) {
  const t = { ...AI_PASTE_MESSAGES, ...messages, kinds: { ...AI_PASTE_MESSAGES.kinds, ...messages?.kinds } }
  const [inner, setInner] = React.useState(defaultValue)
  const text = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const [held, setHeld] = React.useState<Held | null>(null)
  const [done, setDone] = React.useState<{ note: string; before: string; caret: number } | null>(null)
  const [status, setStatus] = React.useState("")
  const fieldRef = React.useRef<HTMLTextAreaElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const autoId = React.useId()
  const fieldId = id ?? autoId

  React.useImperativeHandle(ref, () => fieldRef.current as HTMLTextAreaElement)

  const commit = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const hold = React.useCallback((sample: ClipboardSample, start: number, end: number, focus = true) => {
    const html = sample.html ?? ""
    const plain = sample.text ?? ""
    if (!html && !decodeTagCharacters(plain).hidden) return false
    const scan = scanPaste(html, plain, { background: sourceBackground })
    if (!scan.hidden.length) return false
    setHeld({ scan, plain, start, end })
    setDone(null)
    setStatus(fill(t.held, { count: scan.hidden.length }))
    if (focus) requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("[data-primary]")?.focus())
    return true
  }, [sourceBackground, t.held])

  React.useEffect(() => {
    if (review) hold(review, text.length, text.length, false)
    // Only the paste given on mount is reviewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insert = (choice: "visible" | "all") => {
    if (!held) return
    const piece = choice === "visible" ? held.scan.visibleText : held.plain || held.scan.visibleText
    const start = Math.min(held.start, text.length)
    const end = Math.min(Math.max(held.end, start), text.length)
    const next = text.slice(0, start) + piece + text.slice(end)
    commit(next)
    setDone({ note: choice === "visible" ? fill(t.pastedVisible, { count: held.scan.hidden.length }) : t.pastedAll, before: text, caret: start })
    setStatus(choice === "visible" ? fill(t.pastedVisible, { count: held.scan.hidden.length }) : t.pastedAll)
    setHeld(null)
    focusAt(start + piece.length)
  }

  const focusAt = (caret: number) =>
    requestAnimationFrame(() => {
      const field = fieldRef.current
      field?.focus()
      field?.setSelectionRange(caret, caret)
    })

  const cancel = () => {
    if (!held) return
    const caret = held.end
    setHeld(null)
    setStatus("")
    focusAt(caret)
  }

  const mark = (passage: string, phrases: string[]) => {
    const phrase = phrases.find((p) => passage.includes(p))
    if (!phrase) return passage
    const i = passage.indexOf(phrase)
    return (
      <>
        {passage.slice(0, i)}
        <mark className="rounded-sm bg-red-500/20 px-0.5 text-inherit">{phrase}</mark>
        {passage.slice(i + phrase.length)}
      </>
    )
  }

  const danger = !!held?.scan.injection
  const small = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="ai-paste-guard" data-state={held ? (danger ? "injection" : "held") : "idle"} className={cn("grid w-full max-w-lg gap-1.5 text-sm", className)}>
      <label htmlFor={fieldId} className="font-medium">{label ?? t.label}</label>
      <textarea
        ref={fieldRef}
        id={fieldId}
        rows={rows}
        value={text}
        onChange={(e) => {
          commit(e.target.value)
          setDone(null)
        }}
        onPaste={(e) => {
          onPaste?.(e)
          if (e.defaultPrevented) return
          const target = e.currentTarget
          const sample = { html: e.clipboardData.getData("text/html"), text: e.clipboardData.getData("text/plain") }
          if (hold(sample, target.selectionStart, target.selectionEnd)) e.preventDefault()
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.key === "Escape" && held) cancel()
        }}
        aria-describedby={[describedBy, held ? `${fieldId}-held` : ""].filter(Boolean).join(" ") || undefined}
        className="min-h-20 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">{status}</span>

      {held && (
        <div
          ref={panelRef}
          role="group"
          aria-labelledby={`${fieldId}-held`}
          onKeyDown={(e) => e.key === "Escape" && cancel()}
          className={cn("mt-1.5 space-y-2 rounded-md border p-3", danger ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5")}
        >
          <p id={`${fieldId}-held`} className={cn("flex gap-1.5 font-medium", danger ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300")}>
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{danger ? t.injectionTitle : held.scan.hidden.length === 1 ? t.heldTitleOne : fill(t.heldTitle, { count: held.scan.hidden.length })}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t.intro}</p>
          <ul className="space-y-2">
            {held.scan.hidden.map((h, i) => (
              <li key={i} className="grid gap-1 border-t border-current/10 pt-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{t.kinds[h.kind]}{h.attribute ? ` (${h.attribute})` : ""}</span>
                  {h.injection.length > 0 && <span className="rounded border border-red-500/40 px-1 text-[11px] font-medium text-red-700 dark:text-red-300">{t.injection}</span>}
                  {h.inPlainText && <span className="rounded border px-1 text-[11px] text-muted-foreground">{t.reaches}</span>}
                </div>
                <p className="line-clamp-4 rounded bg-background/70 px-2 py-1 font-mono break-words whitespace-pre-wrap">{mark(h.text, h.injection)}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" data-primary onClick={() => insert("visible")} className={cn(small, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              <EyeOff aria-hidden className="size-4" />
              {t.visibleOnly}
            </button>
            <button type="button" onClick={() => insert("all")} className={cn(small, "border bg-background hover:bg-accent")}>{t.everything}</button>
            <button type="button" onClick={cancel} className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")}>{t.cancel}</button>
          </div>
        </div>
      )}

      {done && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="min-w-0">{done.note}</span>
          <button
            type="button"
            onClick={() => {
              commit(done.before)
              setDone(null)
              focusAt(done.caret)
            }}
            className="rounded-md px-1.5 py-0.5 font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {t.undo}
          </button>
        </p>
      )}
    </div>
  )
}
