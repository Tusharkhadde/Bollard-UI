"use client"

import * as React from "react"
import { Paperclip, Send, X } from "lucide-react"

import { cn } from "@/lib/utils"

const PHRASES = [
  // Hinglish and Hindi
  /\battach\s+(?:kar|kr)\s*(?:diya|diye|di|dia|raha|rahi|rha|rhi)\b/i,
  /\battach\s+(?:kiya|kiye|ki)\b/i,
  /\bfile\s+bhej\s*(?:di|diya|dia|raha|rahi|rha)\b/i,
  /संलग्न|अटैच/,
  // English
  /\bp\.?f\.?a\b/i,
  /\b(?:please\s+)?find\s+(?:the\s+)?(?:attached|enclosed)\b/i,
  /\battach(?:ed|ing|ment|ments)?\b/i,
  /\benclos(?:ed|ing|ure)\b/i,
  /\b(?:see|find|check|open)\s+the\s+(?:file|document|doc|sheet|deck)\b/i,
  /\bi(?:'ve| have)\s+included\b/i,
  /\b[\w-]+\.(?:pdf|docx?|xlsx?|pptx?|csv|png|jpe?g|zip)\b/i,
]

// "I'll attach it later", "no attachment needed", "without the file": don't nag.
const NEGATION_BEFORE = /(?:\b(?:no|not|without|won't)\s+(?:\w+\s+){0,2}|\b(?:will|i'll|we'll)\s+)$/i
const LATER_AFTER = /^\W*(?:\w+\s+){0,2}(?:later|tomorrow|next|baad\s+mein|kal)\b/i
const SHARE_LINK = /\b(?:drive\.google\.com|docs\.google\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|we\.tl)\b/i

/**
 * Returns the phrase that implies a file is attached ("PFA", "see the file",
 * "attach kar diya"), or null. Ignores quoted reply lines (starting with ">"),
 * negated or future mentions, and messages that already share a cloud link.
 */
export function mentionsAttachment(text: string, extraPhrases: RegExp[] = []): string | null {
  const body = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
  if (SHARE_LINK.test(body)) return null
  for (const pattern of [...extraPhrases, ...PHRASES]) {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
    for (const match of body.matchAll(global)) {
      const before = body.slice(Math.max(0, match.index - 30), match.index)
      const after = body.slice(match.index + match[0].length, match.index + match[0].length + 24)
      if (!NEGATION_BEFORE.test(before) && !LATER_AFTER.test(after)) return match[0]
    }
  }
  return null
}

export interface Attachment {
  id: string
  name: string
}

export interface AttachmentNudgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "defaultValue"> {
  /** The message text (controlled). */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called on every edit. */
  onValueChange?: (value: string) => void
  /** Files currently attached to the message. */
  attachments: Attachment[]
  /** Open your file picker. Called from the Attach buttons. */
  onAttach: () => void
  /** Remove one attachment. Hides the remove buttons when omitted. */
  onRemoveAttachment?: (id: string) => void
  /** Send the message. Runs immediately unless an attachment seems to be missing. */
  onSend: (value: string) => void
  /** Extra trigger phrases for your domain, e.g. /\binvoice\b/i. */
  extraPhrases?: RegExp[]
  /** Accessible label for the textarea. */
  label?: string
  /** Placeholder text for the message box. */
  placeholder?: string
  /** Question in the send prompt; the matched phrase is shown before it. */
  promptLabel?: string
  /** Hint while typing, after the matched phrase: “PFA” but nothing is attached. */
  hintLabel?: string
  /** Attach button text in the prompt. */
  attachLabel?: string
  /** Text of the button that sends without a file. */
  sendAnywayLabel?: string
  /** Send button text. */
  sendLabel?: string
}

const button =
  "inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A message composer that catches the "here's the file" email with no file.
 * It notices attachment phrases as you type and, on send, asks inline
 * whether to attach or send anyway. Cmd/Ctrl+Enter sends.
 */
export function AttachmentNudge({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  attachments,
  onAttach,
  onRemoveAttachment,
  onSend,
  extraPhrases,
  label = "Message",
  placeholder = "Write a message…",
  promptLabel = "Send without it?",
  hintLabel = "but nothing is attached",
  attachLabel = "Attach",
  sendAnywayLabel = "Send anyway",
  sendLabel = "Send",
  className,
  ...props
}: AttachmentNudgeProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  const [asking, setAsking] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const attachRef = React.useRef<HTMLButtonElement>(null)
  const sendRef = React.useRef<HTMLButtonElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const promptId = React.useId()
  const phrase = attachments.length === 0 ? mentionsAttachment(value, extraPhrases) : null
  const showPrompt = asking && phrase !== null

  // Focus the prompt when it opens; when it closes (a file arrived), hand focus to Send, not <body>.
  const wasShown = React.useRef(false)
  React.useEffect(() => {
    if (showPrompt) attachRef.current?.focus()
    else if (wasShown.current && !rootRef.current?.contains(document.activeElement)) sendRef.current?.focus()
    wasShown.current = showPrompt
  }, [showPrompt])

  const setValue = (next: string) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
    setAsking(false)
  }

  const send = () => {
    if (!value.trim() && attachments.length === 0) return
    if (phrase && !asking) return setAsking(true)
    setAsking(false)
    onSend(value)
  }

  return (
    <div
      ref={rootRef}
      data-slot="attachment-nudge"
      data-state={showPrompt ? "asking" : phrase ? "missing" : "ok"}
      className={cn(
        "w-full max-w-lg rounded-xl border bg-card text-card-foreground shadow-xs transition-shadow has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/50",
        className
      )}
      {...props}
    >
      <textarea
        ref={textareaRef}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        rows={4}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            send()
          }
        }}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        className="block w-full resize-none rounded-t-xl bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
      />

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pb-2" aria-label="Attachments">
          {attachments.map((file) => (
            <li key={file.id} className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-muted pr-1 pl-2 text-xs">
              <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{file.name}</span>
              {onRemoveAttachment && (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(file.id)}
                  aria-label={`Remove ${file.name}`}
                  className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showPrompt && (
        <div
          role="group"
          aria-labelledby={promptId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setAsking(false)
              textareaRef.current?.focus()
            }
          }}
          className="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50"
        >
          <p id={promptId} className="flex min-w-48 flex-1 items-start gap-2">
            <Paperclip aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              You wrote <strong className="font-semibold">&ldquo;{phrase}&rdquo;</strong> but nothing is attached. {promptLabel}
            </span>
          </p>
          <div className="flex gap-2">
            <button ref={attachRef} type="button" onClick={onAttach} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              <Paperclip className="size-4" aria-hidden />
              {attachLabel}
            </button>
            <button type="button" onClick={send} className={cn(button, "border bg-background text-foreground hover:bg-accent")}>
              {sendAnywayLabel}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t p-2">
        <button
          type="button"
          onClick={onAttach}
          aria-label="Attach a file"
          title="Attach a file"
          className={cn(button, "size-8 justify-center px-0 text-muted-foreground hover:bg-accent hover:text-foreground")}
        >
          <Paperclip className="size-4" aria-hidden />
        </button>
        <p aria-live="polite" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          {phrase && !showPrompt && (
            <>
              <Paperclip aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">&ldquo;{phrase}&rdquo; {hintLabel}</span>
            </>
          )}
        </p>
        <button ref={sendRef} type="button" onClick={send} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {sendLabel}
          <Send className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
