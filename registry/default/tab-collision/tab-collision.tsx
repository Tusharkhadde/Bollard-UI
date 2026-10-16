"use client"

// Bollard UI — tab-collision · MIT licence · https://bollard-ui.vercel.app/components/tab-collision

import * as React from "react"
import { AppWindow, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

type Message = { type: "hello" | "here" | "claim" | "bye"; tab: string; at: number; dirty?: boolean }

/** Fallback listeners in this document; `storage` events only reach other tabs, so same-page instances are told directly. */
const sameDocument = new Set<{ name: string; onMessage: (message: Message) => void }>()

/** BroadcastChannel where it exists, otherwise a localStorage write that other tabs see as a `storage` event. */
export function openTabChannel(name: string, onMessage: (message: Message) => void) {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(name)
    channel.onmessage = (event: MessageEvent<Message>) => onMessage(event.data)
    return { post: (message: Message) => channel.postMessage(message), close: () => channel.close() }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === name && event.newValue) onMessage(JSON.parse(event.newValue) as Message)
  }
  const self = { name, onMessage }
  window.addEventListener("storage", onStorage)
  sameDocument.add(self)
  return {
    // A nonce makes every write a change, so repeated messages still fire.
    post: (message: Message) => {
      for (const other of sameDocument) if (other !== self && other.name === name) other.onMessage(message)
      try {
        localStorage.setItem(name, JSON.stringify({ ...message, nonce: Math.random() }))
      } catch {}
    },
    close: () => {
      sameDocument.delete(self)
      window.removeEventListener("storage", onStorage)
    },
  }
}

export type TabStatus = "checking" | "editing" | "read-only"

/**
 * Coordinates one editor per record across tabs. The newest tab gets the pen,
 * unless the older one has unsaved changes. There is no heartbeat: tabs ask
 * "who has it?" when they open or come back into view, so a throttled
 * background tab is never mistaken for a closed one.
 */
export function useTabCollision(recordId: string, { dirty = false, probe = 400, prefix = "bollard-ui:tab-collision:" } = {}) {
  const [status, setStatus] = React.useState<TabStatus>("checking")
  const [otherDirty, setOtherDirty] = React.useState(false)
  const self = React.useRef<{ status: TabStatus; dirty: boolean; otherDirty: boolean; claimedAt: number; post: (message: Message) => void; claim: () => void }>({
    status, dirty, otherDirty: false, claimedAt: 0, post: () => {}, claim: () => {},
  })
  self.current.status = status
  self.current.dirty = dirty

  React.useEffect(() => {
    const s = self.current
    const tab = crypto.randomUUID?.() ?? String(Math.random())
    let answered = false
    let leaving = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const markOther = (value: boolean) => setOtherDirty((s.otherDirty = value))
    const channel = openTabChannel(prefix + recordId, (message) => {
      if (message.tab === tab) return
      if (message.type === "hello" && s.status === "editing") channel.post({ type: "here", tab, at: Date.now(), dirty: s.dirty })
      if (message.type === "here") {
        answered = true
        markOther(Boolean(message.dirty))
      }
      // Newest claim wins; on an exact tie the larger id does, so two tabs can't both yield.
      if (message.type === "claim" && (message.at > s.claimedAt || (message.at === s.claimedAt && message.tab > tab))) {
        markOther(false)
        setStatus("read-only")
      }
      // Deferred, so a read-only twin on a page that is itself closing doesn't grab the pen on its way out.
      if (message.type === "bye") setTimeout(() => !leaving && s.status === "read-only" && s.claim(), 50)
    })
    s.post = (message) => channel.post({ ...message, tab })
    s.claim = () => {
      s.claimedAt = Date.now()
      channel.post({ type: "claim", tab, at: s.claimedAt })
      markOther(false)
      setStatus("editing")
    }
    /** Ask who has the record. Nobody answers: take it. On first open, also take it unless the holder has unsaved changes. */
    const ask = (firstOpen: boolean) => {
      answered = false
      channel.post({ type: "hello", tab, at: Date.now() })
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!answered || (firstOpen && !s.otherDirty)) s.claim()
        else setStatus("read-only")
      }, probe)
    }
    const onVisible = () => document.visibilityState === "visible" && s.status === "read-only" && ask(false)
    const onLeave = () => {
      leaving = true
      if (s.status === "editing") channel.post({ type: "bye", tab, at: Date.now() })
    }
    // Back from the bfcache: someone else may hold the record now.
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      leaving = false
      ask(false)
    }
    window.addEventListener("pageshow", onShow)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener("pagehide", onLeave)
    ask(true)
    return () => {
      onLeave()
      clearTimeout(timer)
      channel.close()
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("pagehide", onLeave)
      window.removeEventListener("pageshow", onShow)
    }
  }, [recordId, probe, prefix])

  // Tell read-only tabs when this one gains or loses unsaved changes.
  React.useEffect(() => {
    if (status === "editing") self.current.post({ type: "here", tab: "", at: Date.now(), dirty })
  }, [dirty, status])

  return { status, otherDirty, takeOver: () => self.current.claim() }
}

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface TabCollisionProps extends React.ComponentProps<"fieldset"> {
  /** Identifies the record; tabs editing different records never collide. */
  recordId: string
  /** Whether this tab has unsaved changes. A newer tab won't take over a dirty one without asking. */
  dirty?: boolean
  /** Called whenever this tab gains or loses the right to edit. */
  onStatusChange?: (status: TabStatus) => void
  /** Shown when another tab is editing. */
  message?: string
  /** Shown when the other tab has unsaved changes. */
  dirtyMessage?: string
  /** Confirmation before taking over. */
  confirmMessage?: string
  /** Label of the Use-this-tab button. */
  takeOverLabel?: string
  /** Label of the confirm-take-over button. */
  confirmLabel?: string
  /** Label of the Cancel button. */
  cancelLabel?: string
  /** Accessible name of the notice. */
  regionLabel?: string
}

/**
 * Stops the same record being edited in two tabs, where the last save
 * silently erases the other. Only one tab edits; the others show "Open in
 * another tab" and become read-only (their form is a disabled fieldset) until
 * you choose "Use this tab". Taking over from a tab with unsaved changes asks
 * first, and closing the editing tab hands editing back automatically.
 */
export function TabCollision({
  recordId,
  dirty = false,
  onStatusChange,
  message = "Open in another tab. Editing is paused here so the two can't overwrite each other.",
  dirtyMessage = "Open in another tab with unsaved changes. Editing is paused here.",
  confirmMessage = "The other tab keeps its unsaved changes but becomes read-only.",
  takeOverLabel = "Use this tab",
  confirmLabel = "Take over anyway",
  cancelLabel = "Cancel",
  regionLabel = "Open in another tab",
  className,
  children,
  ...props
}: TabCollisionProps) {
  const { status, otherDirty, takeOver } = useTabCollision(recordId, { dirty })
  const [confirming, setConfirming] = React.useState(false)
  const readOnly = status === "read-only"
  const statusRef = React.useRef(onStatusChange)
  statusRef.current = onStatusChange

  React.useEffect(() => {
    if (status !== "checking") statusRef.current?.(status)
    setConfirming(false)
  }, [status])

  return (
    <div data-slot="tab-collision" data-status={status} className={cn("grid w-full gap-3", className)}>
      {readOnly && (
        <div
          role="region"
          aria-label={regionLabel}
          className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 px-3 py-1.5 text-sm text-amber-950 dark:text-amber-50"
        >
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            {confirming ? <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" /> : <AppWindow aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />}
            <p aria-live="polite" className="min-w-0 flex-1 font-medium">
              {confirming ? confirmMessage : otherDirty ? dirtyMessage : message}
            </p>
          </div>
          <div className="ml-auto flex gap-2" onKeyDown={(event) => event.key === "Escape" && setConfirming(false)}>
            {confirming && (
              <button type="button" onClick={() => setConfirming(false)} className={cn(action, "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25")}>
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => (otherDirty && !confirming ? setConfirming(true) : takeOver())}
              className={cn(action, "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300")}
            >
              {confirming ? confirmLabel : takeOverLabel}
            </button>
          </div>
        </div>
      )}
      <fieldset disabled={readOnly} className={cn("m-0 min-w-0 border-0 p-0 transition-opacity", readOnly && "opacity-60")} {...props}>
        {children}
      </fieldset>
    </div>
  )
}
