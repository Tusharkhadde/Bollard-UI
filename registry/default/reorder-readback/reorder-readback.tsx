"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Check, GripVertical, Lock, Undo2 } from "lucide-react"
import { AnimatePresence, MotionConfig, Reorder, animate, motion, useDragControls, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { brokenPin, describeMove, moveItem, normalizeOrder, ordinal, shiftsSince } from "./reorder"

export { brokenPin, describeMove, moveItem, normalizeOrder, ordinal, shiftsSince } from "./reorder"

export const REORDER_READBACK_MESSAGES = {
  /** `{item}`, `{from}` and `{to}` are filled in. */
  moved: "Moved {item} from {from} to {to}.",
  /** Appended when `describePosition` says what the new place means. */
  meaning: "It's now {meaning}.",
  undo: "Undo",
  pinned: "{item} is pinned to {at}, so it can't move and nothing can pass it.",
  handle: "Move {item}, {at} of {total}",
  instructions: "Press Space or click to pick up. Then use the arrow keys or the arrow buttons, and Space or Done to drop. Escape cancels.",
  pickedUp: "{item} picked up at {at} of {total}.",
  position: "{item}, {at} of {total}.",
  cancelled: "Cancelled. {item} is back at {at}.",
  moveUp: "Move {item} up",
  moveDown: "Move {item} down",
  done: "Done",
  changed: "{count} moved since saved",
  revert: "Revert",
}

export interface ReorderItem {
  id: string
  /** Name used in every readback and announcement. */
  label: string
  /** Optional second line. */
  description?: React.ReactNode
  /** Pinned items keep their place, and moves that would push them aside are refused with a reason. */
  pinned?: boolean
}

export interface ReorderReadbackProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Rows to order, each with an id and a name. */
  items: ReorderItem[]
  /** Order as a list of ids (controlled). */
  value?: string[]
  /** Initial order when uncontrolled. Defaults to the order of `items`. */
  defaultValue?: string[]
  /** Fires once per finished move (on drop, never mid-drag), with the new order. */
  onValueChange?: (order: string[]) => void
  /** The last saved order. Rows that moved since show ↑/↓ and the header offers Revert. */
  baseline?: string[]
  /** What a place means, so the readback says the consequence: `(i) => i === 0 ? "tried first" : ""`. */
  describePosition?: (index: number, total: number) => string
  /** Position wording, "3rd" by default. */
  formatPosition?: (index: number) => string
  /** Accessible name of the list. */
  label?: string
  /** Visible text, all overridable. */
  messages?: Partial<typeof REORDER_READBACK_MESSAGES>
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const iconButton =
  "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"

/**
 * A sortable list that says what every move did. A drop reads back "Moved Razorpay from 3rd to 1st.
 * It's now tried first." with Undo, so a slip of the finger is seen and reversed instead of silently
 * reordering priorities, fallbacks or steps. Dragging starts only from the grip, so scrolling on touch
 * never reorders anything; pinned rows refuse to be pushed aside with a reason; rows moved since the
 * last save are marked with how far. WCAG 2.2 SC 2.5.7 is met without dragging: click the grip and use
 * the arrow buttons. The keyboard picks up with Space, moves with arrows and cancels with Escape, with
 * debounced position announcements. Rows glide with layout animation and the moved row flashes.
 */
export function ReorderReadback({
  items,
  value,
  defaultValue,
  onValueChange,
  baseline,
  describePosition,
  formatPosition = ordinal,
  label = "Order",
  messages,
  className,
  ...props
}: ReorderReadbackProps) {
  const m = { ...REORDER_READBACK_MESSAGES, ...messages }
  const ids = items.map((item) => item.id)
  const byId = new Map(items.map((item) => [item.id, item]))
  const pinned = new Set(items.filter((item) => item.pinned).map((item) => item.id))
  const [inner, setInner] = React.useState(() => normalizeOrder(defaultValue, ids))
  const committed = normalizeOrder(value ?? inner, ids)
  const [live, setLive] = React.useState<string[] | null>(null)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [readback, setReadback] = React.useState<{ text: string; before: string[]; id: string } | null>(null)
  const [refusal, setRefusal] = React.useState("")
  const [status, setStatus] = React.useState("")
  const snapshot = React.useRef<string[]>([])
  // The order mid-move, readable from gesture callbacks that may hold an older render's closure.
  const current = React.useRef<string[]>([])
  const rows = React.useRef(new Map<string, HTMLElement>())
  const statusTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const reduce = useReducedMotion()
  const instructionsId = React.useId()
  const order = live ?? committed
  const total = order.length
  const name = (id: string) => byId.get(id)?.label ?? id

  // One status region, debounced so fast arrow presses don't pile up announcements.
  const say = (text: string) => {
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(text), 150)
  }
  React.useEffect(() => () => clearTimeout(statusTimer.current), [])

  const flash = (id: string) => {
    const row = rows.current.get(id)
    if (row && !reduce) animate(row, { backgroundColor: ["color-mix(in oklab, var(--primary) 14%, var(--card))", "var(--card)"] }, { duration: 0.9 })
  }

  /** Accept a candidate order unless it would push a pinned row aside. */
  const propose = (next: string[]) => {
    const pin = brokenPin(snapshot.current, next, pinned)
    if (pin) {
      setRefusal(fill(m.pinned, { item: name(pin), at: formatPosition(snapshot.current.indexOf(pin)) }))
      return false
    }
    setRefusal("")
    current.current = next
    setLive(next)
    return true
  }

  const begin = () => {
    snapshot.current = committed
    current.current = committed
    setLive(committed)
    setReadback(null)
    setRefusal("")
  }

  const finish = (next: string[]) => {
    setLive(null)
    const move = describeMove(snapshot.current, next)
    if (!move) return
    // A refusal met mid-drag is history once the row lands somewhere allowed.
    setRefusal("")
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    const meaning = describePosition?.(move.to, next.length)
    const text = `${fill(m.moved, { item: name(move.id), from: formatPosition(move.from), to: formatPosition(move.to) })}${meaning ? ` ${fill(m.meaning, { meaning })}` : ""}`
    setReadback({ text, before: snapshot.current, id: move.id })
    say(text)
    requestAnimationFrame(() => flash(move.id))
  }

  const undo = () => {
    if (!readback) return
    const { id, before } = readback
    if (value === undefined) setInner(before)
    onValueChange?.(before)
    setReadback(null)
    say(fill(m.position, { item: name(id), at: formatPosition(before.indexOf(id)), total }))
    requestAnimationFrame(() => flash(id))
    // Undo's button disappears, so focus goes to the restored row's grip.
    rows.current.get(id)?.querySelector<HTMLElement>("[data-grip]")?.focus()
  }

  const step = (id: string, by: number) => {
    const from = order.indexOf(id)
    const next = moveItem(order, from, from + by)
    if (next[from] !== id && propose(next)) say(fill(m.position, { item: name(id), at: formatPosition(next.indexOf(id)), total }))
  }

  const pickUp = (id: string) => {
    if (pinned.has(id)) {
      setRefusal(fill(m.pinned, { item: name(id), at: formatPosition(order.indexOf(id)) }))
      return
    }
    begin()
    setPicked(id)
    say(fill(m.pickedUp, { item: name(id), at: formatPosition(order.indexOf(id)), total }))
  }
  const drop = () => {
    setPicked(null)
    finish(current.current)
  }
  const cancel = (id: string) => {
    setPicked(null)
    setLive(null)
    say(fill(m.cancelled, { item: name(id), at: formatPosition(snapshot.current.indexOf(id)) }))
  }

  const shifts = baseline ? shiftsSince(normalizeOrder(baseline, ids), committed) : new Map<string, number>()

  return (
    <MotionConfig reducedMotion="user">
      <div data-slot="reorder-readback" data-state={picked ? "moving" : "idle"} className={cn("grid w-full max-w-md grid-cols-1 gap-2 text-sm", className)} {...props}>
        {shifts.size > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{fill(m.changed, { count: shifts.size })}</span>
            <button
              type="button"
              onClick={() => {
                const back = normalizeOrder(baseline, ids)
                if (value === undefined) setInner(back)
                onValueChange?.(back)
                setReadback(null)
                // The Revert button goes away with the changes, so focus lands on the first grip.
                requestAnimationFrame(() => rows.current.get(back[0])?.querySelector<HTMLElement>("[data-grip]")?.focus())
              }}
              className="h-7 rounded-md px-2 font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {m.revert}
            </button>
          </div>
        )}
        <span id={instructionsId} className="sr-only">
          {m.instructions}
        </span>
        <Reorder.Group axis="y" as="ol" values={order} onReorder={propose} aria-label={label} className="grid grid-cols-1 gap-1.5">
          {order.map((id, index) => (
            <Row
              key={id}
              id={id}
              item={byId.get(id)!}
              index={index}
              total={total}
              picked={picked === id}
              shift={shifts.get(id)}
              m={m}
              formatPosition={formatPosition}
              instructionsId={instructionsId}
              rowRef={(node) => {
                if (node) rows.current.set(id, node)
                else rows.current.delete(id)
              }}
              onDragStart={begin}
              onDragEnd={() => finish(current.current)}
              onPick={() => (picked === id ? drop() : pickUp(id))}
              onStep={(by) => step(id, by)}
              onCancel={() => cancel(id)}
              onDrop={drop}
            />
          ))}
        </Reorder.Group>
        <AnimatePresence initial={false} mode="popLayout">
          {(refusal || readback) && (
            <motion.p
              key={refusal || readback?.text}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                refusal ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "bg-muted/50",
              )}
            >
              {refusal ? <Lock aria-hidden className="size-3.5 shrink-0" /> : <Check aria-hidden className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              <span className="min-w-0 flex-1">{refusal || readback?.text}</span>
              {!refusal && readback && (
                <button
                  type="button"
                  onClick={undo}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border bg-background px-2 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <Undo2 aria-hidden className="size-3.5" /> {m.undo}
                </button>
              )}
            </motion.p>
          )}
        </AnimatePresence>
        <span role="status" className="sr-only">
          {refusal || status}
        </span>
      </div>
    </MotionConfig>
  )
}

interface RowProps {
  /** Row id. */
  id: string
  /** The row being rendered. */
  item: ReorderItem
  /** Current position, 0-based. */
  index: number
  /** Number of rows. */
  total: number
  /** True while picked up with the keyboard. */
  picked: boolean
  /** Offset from the saved baseline, when moved. */
  shift?: number
  /** Resolved messages. */
  m: typeof REORDER_READBACK_MESSAGES
  /** Turns a 0-based index into "1st", "2nd"… */
  formatPosition: (index: number) => string
  /** Id of the keyboard instructions element. */
  instructionsId: string
  /** Registers the row element for focus management. */
  rowRef: (node: HTMLElement | null) => void
  /** Called when a grip drag starts. */
  onDragStart: () => void
  /** Called when a grip drag ends. */
  onDragEnd: () => void
  /** Picks up or drops the row. */
  onPick: () => void
  /** Moves the picked row by this many places. */
  onStep: (by: number) => void
  /** Cancels a keyboard move. */
  onCancel: () => void
  /** Drops the row at its current place. */
  onDrop: () => void
}

function Row({ id, item, index, total, picked, shift, m, formatPosition, instructionsId, rowRef, onDragStart, onDragEnd, onPick, onStep, onCancel, onDrop }: RowProps) {
  const controls = useDragControls()
  const dragged = React.useRef(false)
  const values = { item: item.label, at: formatPosition(index), total }

  return (
    <Reorder.Item
      value={id}
      ref={rowRef}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => {
        dragged.current = true
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.25)", zIndex: 10 }}
      className={cn("relative flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-1.5 pl-1", picked && "ring-[3px] ring-ring/50")}
    >
      <button
        type="button"
        data-grip
        aria-label={fill(m.handle, values)}
        aria-describedby={instructionsId}
        aria-pressed={picked}
        aria-disabled={item.pinned || undefined}
        onPointerDown={(event) => {
          dragged.current = false
          if (!item.pinned) controls.start(event)
        }}
        onClick={() => {
          // A drag ends in a click too; only a press without a drag picks the row up.
          if (!dragged.current) onPick()
          dragged.current = false
        }}
        onKeyDown={(event) => {
          if (!picked) return
          const keys: Record<string, () => void> = { ArrowUp: () => onStep(-1), ArrowDown: () => onStep(1), Escape: onCancel }
          keys[event.key]?.()
          if (keys[event.key]) event.preventDefault()
        }}
        className={cn(iconButton, "touch-none", item.pinned ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
      >
        {item.pinned ? <Lock aria-hidden className="size-3.5" /> : <GripVertical aria-hidden className="size-4" />}
      </button>
      <span aria-hidden className="w-7 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.label}</p>
        {item.description && <p className="truncate text-xs text-muted-foreground">{item.description}</p>}
      </div>
      {shift !== undefined && !picked && (
        <span className={cn("shrink-0 text-xs tabular-nums", shift > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
          {shift > 0 ? "↑" : "↓"}
          {Math.abs(shift)}
        </span>
      )}
      {picked && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label={fill(m.moveUp, values)} disabled={index === 0} onClick={() => onStep(-1)} className={iconButton}>
            <ArrowUp aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label={fill(m.moveDown, values)} disabled={index === total - 1} onClick={() => onStep(1)} className={iconButton}>
            <ArrowDown aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDrop}
            className="h-7 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {m.done}
          </button>
        </span>
      )}
    </Reorder.Item>
  )
}
