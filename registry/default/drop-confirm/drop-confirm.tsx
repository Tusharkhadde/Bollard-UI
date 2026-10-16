"use client"

import * as React from "react"
import { Check, Folder, FolderInput, Hand, LoaderCircle, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface MoveItems {
  count: number
  /** Singular noun, e.g. "file". */
  noun?: string
  /** Plural noun when it isn't noun + "s". */
  plural?: string
  /** Who can see the items where they are now, e.g. "Private" or "Shared with Marketing". */
  space?: string
}

/** "1 file", "12 files", "3 people". Pass a `locale` to group digits for it (1.200 Dateien). */
export function formatCount({ count, noun = "file", plural }: MoveItems, locale?: string) {
  return `${count.toLocaleString(locale)} ${count === 1 ? noun : (plural ?? `${noun}s`)}`
}

/** Why a move needs a second look, or null when it can go straight through. Items with no `space` are in `homeSpace`. */
export function moveRisk(items: MoveItems, space: string, confirmAbove: number, homeSpace = "Private"): "space" | "large" | null {
  if ((items.space ?? homeSpace) !== space) return "space"
  return items.count >= confirmAbove ? "large" : null
}

type Status =
  | { type: "idle" }
  | { type: "flicked" }
  | { type: "confirm"; items: MoveItems; risk: "space" | "large" }
  | { type: "pending"; items: MoveItems }
  | { type: "moved"; items: MoveItems }
  | { type: "undone"; items: MoveItems }

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const small =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const inline =
  "inline-flex h-6 items-center gap-1 rounded-md border px-2 font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface DropConfirmProps extends Omit<React.ComponentProps<"div">, "onDrop"> {
  /** Folder name, used in every message. */
  destination: string
  /** Who can see this folder. Items arriving from a different space ask first. Defaults to `homeSpace`. */
  space?: string
  /** What a drag or the Move here button would move: the current selection. Without it, dragged OS files are counted. */
  items: MoveItems | null
  /** Performs the move. Return a promise to show a pending state. */
  onMove: (items: MoveItems) => void | Promise<void>
  /** Puts the items back. Without it there is no Undo. */
  onUndo?: (items: MoveItems) => void
  /** Drops sooner than this (ms) after entering the zone are ignored as an accidental flick. */
  settleTime?: number
  /** Moves of at least this many items ask first. */
  confirmAbove?: number
  /** How long Undo stays offered, in ms. */
  undoTimeout?: number
  /** Templates: `{count}` ("12 files"), `{destination}`, `{from}` and `{to}` are filled in. */
  dragText?: string
  /** Shown when a drop was ignored because it came too fast. */
  flickText?: string
  /** Warning when the move changes who can see the items. */
  spaceText?: string
  /** Warning for large moves. */
  largeText?: string
  /** Shown after a move. */
  movedText?: string
  /** Shown after Undo. */
  undoneText?: string
  /** Text for the Move here button. */
  moveHereLabel?: string
  /** Text for the confirm button. */
  confirmLabel?: string
  /** Text for the cancel button. */
  cancelLabel?: string
  /** Text for the Undo button. */
  undoLabel?: string
  /** Hint under the folder while the pointer is settling, and once it's armed. */
  settlingText?: string
  /** Shown once the pointer has rested long enough to drop. */
  armedText?: string
  /** Screen reader name of Move here. `{label}`, `{count}` and `{destination}` are filled in. */
  moveHereAriaLabel?: string
  /** Turns items into words for `{count}`, e.g. with your i18n plural rules. Defaults to `formatCount`. */
  formatItems?: (items: MoveItems) => string
  /** Where items with no `space` are. Defaults to "Private"; set it when you translate the space names. */
  homeSpace?: string
}

/**
 * A drop target that makes drag-and-drop moves deliberate. While dragging it
 * says exactly what will happen ("Move 12 files to Archive") and arms only after
 * the pointer has rested for `settleTime`, so a flick across the folder on the
 * way somewhere else moves nothing. Moves that change who can see the items, or
 * that are large, ask once; every move offers Undo. "Move here" does the same
 * for keyboard and touch users.
 */
export function DropConfirm({
  destination,
  space: spaceProp,
  items,
  onMove,
  onUndo,
  settleTime = 350,
  confirmAbove = 20,
  undoTimeout = 6000,
  dragText = "Move {count} to {destination}",
  flickText = "That drop was too quick, so nothing moved. Hold over the folder a moment.",
  spaceText = "Moving {count} from {from} to {to} changes who can see them.",
  largeText = "Move all {count} to {destination}?",
  movedText = "Moved {count} to {destination}.",
  undoneText = "Moved {count} back.",
  moveHereLabel = "Move here",
  confirmLabel = "Move {count}",
  cancelLabel = "Cancel",
  undoLabel = "Undo",
  settlingText = "Hold a moment…",
  armedText = "Release to move",
  moveHereAriaLabel = "{label}: {count} to {destination}",
  formatItems = (i) => formatCount(i),
  homeSpace = "Private",
  className,
  ref,
  ...props
}: DropConfirmProps) {
  const space = spaceProp ?? homeSpace
  const [drag, setDrag] = React.useState<{ items: MoveItems; armed: boolean } | null>(null)
  const [settling, setSettling] = React.useState(false)
  const [status, setStatus] = React.useState<Status>({ type: "idle" })
  const depth = React.useRef(0)
  const enteredAt = React.useRef(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const focusCancel = React.useRef(false)
  const statusId = React.useId()

  React.useEffect(() => {
    if (status.type !== "confirm" || !focusCancel.current) return
    focusCancel.current = false
    cancelRef.current?.focus()
  }, [status])

  React.useEffect(() => {
    if (!drag || drag.armed) return
    // Two frames so the empty settle bar paints before it starts filling.
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => setSettling(true))))
    const timer = setTimeout(() => setDrag((current) => current && { ...current, armed: true }), settleTime)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      setSettling(false)
    }
  }, [drag, settleTime])

  React.useEffect(() => {
    const ms = status.type === "moved" ? undoTimeout : status.type === "flicked" || status.type === "undone" ? 4000 : 0
    if (!ms) return
    const timer = setTimeout(() => setStatus({ type: "idle" }), ms)
    return () => clearTimeout(timer)
  }, [status, undoTimeout])

  const dragged = (event: React.DragEvent): MoveItems | null => {
    if (items) return items
    const files = Array.from(event.dataTransfer.items).filter((item) => item.kind === "file").length
    return files ? { count: files } : null
  }

  const move = async (next: MoveItems, confirmed = false) => {
    const risk = moveRisk(next, space, confirmAbove, homeSpace)
    if (risk && !confirmed) {
      // Keyboard users land on Cancel, the safe choice; a mouse drop doesn't steal focus.
      focusCancel.current = Boolean(rootRef.current?.contains(document.activeElement))
      setStatus({ type: "confirm", items: next, risk })
      return
    }
    setStatus({ type: "pending", items: next })
    try {
      await onMove(next)
      setStatus({ type: "moved", items: next })
    } catch {
      // The caller reports the error; the zone just becomes usable again.
      setStatus({ type: "idle" })
    }
  }

  const shown = drag?.items ?? (status.type !== "idle" && "items" in status ? status.items : items)
  const values = {
    count: shown ? formatItems(shown) : "",
    destination,
    from: shown?.space ?? homeSpace,
    to: space,
  }

  return (
    <div
      ref={rootRef}
      data-slot="drop-confirm"
      data-state={drag ? (drag.armed ? "armed" : "settling") : status.type}
      role="group"
      aria-label={destination}
      aria-describedby={statusId}
      onDragEnter={(event) => {
        const next = dragged(event)
        if (!next) return
        event.preventDefault()
        if (depth.current++ === 0) {
          enteredAt.current = performance.now()
          setDrag({ items: next, armed: false })
        }
      }}
      onDragOver={(event) => {
        if (!drag) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
      }}
      onDragLeave={() => {
        if (depth.current > 0 && --depth.current === 0) setDrag(null)
      }}
      onDrop={(event) => {
        event.preventDefault()
        const next = drag?.items ?? (event.dataTransfer.files.length ? { count: event.dataTransfer.files.length } : null)
        depth.current = 0
        setDrag(null)
        if (!next) return
        if (performance.now() - enteredAt.current < settleTime) setStatus({ type: "flicked" })
        else void move(next)
      }}
      onKeyDown={(event) => event.key === "Escape" && status.type === "confirm" && setStatus({ type: "idle" })}
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-background transition-[border-color,background-color,box-shadow]",
        drag && "border-dashed border-primary/50 bg-accent/60",
        drag?.armed && "border-solid border-primary ring-[3px] ring-ring/30",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-14 items-center gap-3 px-3 py-2">
        {drag ? (
          <FolderInput aria-hidden className="size-5 shrink-0 text-primary" />
        ) : (
          <Folder aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">{drag ? fill(dragText, values) : destination}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {drag && !drag.armed && <Hand aria-hidden className="size-3.5" />}
            {drag ? (drag.armed ? armedText : settlingText) : space}
          </p>
        </div>
        {!drag && (
          <button
            type="button"
            disabled={!items?.count || status.type === "pending" || status.type === "confirm"}
            aria-label={items?.count ? fill(moveHereAriaLabel, { label: moveHereLabel, count: formatItems(items), destination }) : undefined}
            onClick={() => items && void move(items)}
            className={cn(small, "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30")}
          >
            {status.type === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {moveHereLabel}
          </button>
        )}
      </div>

      <div id={statusId} aria-live="polite" className="text-xs empty:hidden">
        {status.type === "flicked" && (
          <p className="flex items-start gap-1.5 border-t px-3 py-2 text-amber-700 dark:text-amber-400">
            <Hand aria-hidden className="mt-px size-3.5 shrink-0" />
            {fill(flickText, values)}
          </p>
        )}
        {status.type === "confirm" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-50">
            <p className="flex min-w-0 flex-1 basis-48 items-start gap-1.5 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {fill(status.risk === "space" ? spaceText : largeText, values)}
            </p>
            <div className="ml-auto flex gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setStatus({ type: "idle" })}
                className={cn(small, "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25")}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => void move(status.items, true)}
                className={cn(small, "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300")}
              >
                {fill(confirmLabel, values)}
              </button>
            </div>
          </div>
        )}
        {(status.type === "moved" || status.type === "undone") && (
          <p className="flex min-h-10 items-center gap-1.5 border-t px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
            <Check aria-hidden className="size-3.5 shrink-0" />
            <span className="flex-1">{fill(status.type === "moved" ? movedText : undoneText, values)}</span>
            {status.type === "moved" && onUndo && (
              <button
                type="button"
                onClick={() => {
                  onUndo(status.items)
                  setStatus({ type: "undone", items: status.items })
                }}
                className={cn(inline, "border-emerald-600/30 text-foreground hover:bg-emerald-500/10")}
              >
                <Undo2 aria-hidden className="size-3.5" />
                {undoLabel}
              </button>
            )}
          </p>
        )}
      </div>

      {drag && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
          style={{
            transform: `scaleX(${settling || drag.armed ? 1 : 0})`,
            transition: settling ? `transform ${settleTime}ms linear` : "none",
          }}
        />
      )}
    </div>
  )
}
