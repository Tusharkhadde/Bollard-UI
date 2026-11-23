"use client"

import * as React from "react"
import { Bot, CircleCheck, Mail, Pause, Play, Wallet } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { trackHeroSceneChange } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { AgentActionApprove, type ToolCall } from "@/registry/default/agent-action-approve/agent-action-approve"
import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { EmailInput } from "@/registry/default/email-input/email-input"

/*
 * The hero demo: three scenes of real Bollard components, driven by one timeline.
 *
 * Every scene is a list of steps at fixed times. What the stage shows is a pure function
 * of (scene, step); the only side effect is the agent scene, which presses the real Deny
 * button so the component's own decided state appears. The stage is `inert` and hidden
 * from assistive tech: it is a moving picture, so it never announces anything. Screen
 * readers get a static description of each scene in the tab panel instead.
 */

type SceneId = "amount" | "email" | "agent"

type Step = {
  at: number
  /** CSS selector inside the stage the fake cursor moves to; null parks it. */
  cursor?: string | null
  click?: boolean
  amount?: number | null
  email?: string
  /** The scene's "caught and fixed" badge. */
  done?: boolean
  /** Press the agent card's Deny button. */
  deny?: boolean
}

type Scene = {
  id: SceneId
  tab: string
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  duration: number
  /** The step shown before autoplay starts (first paint) and with reduced motion: the mistake, caught. */
  poster: number
  badge: string
  description: string
  steps: Step[]
}

const typed = (text: string, start: number, every: number) =>
  Array.from(text, (_, i) => ({ at: start + i * every, text: text.slice(0, i + 1) }))

const AMOUNT_STEPS: Step[] = [
  { at: 0, amount: null, cursor: "input", done: false },
  ...typed("240000", 450, 170).map(({ at, text }) => ({ at, amount: Number(text) })),
  { at: 2900, cursor: "[data-slot=amount-input] button" },
  { at: 3650, click: true, amount: 24000, done: true },
  { at: 4400, cursor: null },
]

const EMAIL_STEPS: Step[] = [
  { at: 0, email: "", cursor: "input", done: false },
  ...typed("alex@gmial.con", 400, 105).map(({ at, text }) => ({ at, email: text })),
  { at: 3000, cursor: "[data-slot=email-input] button" },
  { at: 3750, click: true, email: "alex@gmail.com", done: true },
  { at: 4500, cursor: null },
]

const AGENT_STEPS: Step[] = [
  { at: 0, cursor: null, done: false },
  { at: 2300, cursor: "[data-slot=agent-action-approve] button" },
  { at: 3200, click: true, deny: true },
  { at: 3500, done: true },
  { at: 4300, cursor: null },
]

const SCENES: Scene[] = [
  {
    id: "amount",
    tab: "Extra zero",
    title: "Pay rent",
    url: "acme.app/pay",
    icon: Wallet,
    duration: 6000,
    poster: AMOUNT_STEPS.findIndex((s) => s.amount === 240000),
    badge: "Extra zero caught · ₹24,000 sent",
    description:
      "A rent payment field with a usual amount of ₹24,000. Someone types ₹2,40,000; the amount input reads it back and asks “Extra zero?”, offering a one-tap fix to ₹24,000.",
    steps: AMOUNT_STEPS,
  },
  {
    id: "email",
    tab: "Email typo",
    title: "Create account",
    url: "acme.app/signup",
    icon: Mail,
    duration: 6000,
    poster: EMAIL_STEPS.findIndex((s) => s.email === "alex@gmial.con"),
    badge: "Typo fixed · the receipt arrives",
    description:
      "A sign-up email field. Someone types alex@gmial.con; the email input asks whether they meant gmail.com, and the suggestion is accepted.",
    steps: EMAIL_STEPS,
  },
  {
    id: "agent",
    tab: "Agent to prod",
    title: "Agent approval",
    url: "agent · tool call",
    icon: Bot,
    duration: 6400,
    poster: 0,
    badge: "Rejected · production untouched",
    description:
      "An AI agent says it will downgrade one expired trial, but its SQL updates every row of the accounts table in production. The approval card flags the mismatch, the missing WHERE clause and that it can't be undone; the human denies it.",
    steps: AGENT_STEPS,
  },
]

const AGENT_CALL: ToolCall = {
  tool: "db.query",
  intent: "Downgrade the one expired trial account",
  sql: "UPDATE accounts SET plan = 'free';",
  environment: "prod",
}

/** Folds the steps up to `index` into the visible state of a scene. */
function frame(scene: Scene, index: number) {
  const state = { amount: null as number | null, email: "", done: false, cursor: null as string | null, click: false, deny: false }
  scene.steps.slice(0, index + 1).forEach((step, i) => {
    if (step.amount !== undefined) state.amount = step.amount
    if (step.email !== undefined) state.email = step.email
    if (step.done !== undefined) state.done = step.done
    if (step.cursor !== undefined) state.cursor = step.cursor
    if (step.deny) state.deny = true
    state.click = i === index && !!step.click
  })
  return state
}

const noop = () => {}

export function HeroDemo({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const [sceneIndex, setSceneIndex] = React.useState(0)
  const [step, setStep] = React.useState(SCENES[0].poster)
  /** Bumped on every scene start so the live components remount fresh. */
  const [run, setRun] = React.useState(0)
  /** Autoplay is on unless the visitor prefers reduced motion; then it waits for Play. */
  const [playing, setPlaying] = React.useState(true)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [hidden, setHidden] = React.useState(false)
  const [offscreen, setOffscreen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const elapsed = React.useRef(SCENES[0].steps[SCENES[0].poster].at)
  /** Where the progress bar starts for the current run, so it lines up with the timeline. */
  const [barStart, setBarStart] = React.useState(SCENES[0].steps[SCENES[0].poster].at)

  // Reduced motion: no autoplay. Show the caught state and offer Play.
  React.useEffect(() => {
    if (reduce) setPlaying(false)
  }, [reduce])

  React.useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    onVisibility()
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  React.useEffect(() => {
    const node = rootRef.current
    if (!node || !("IntersectionObserver" in window)) return
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0.2 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const scene = SCENES[sceneIndex]
  const paused = !playing || hovered || focused || hidden || offscreen

  const goTo = React.useCallback((index: number, trigger: "auto" | "tab" | "play", from: "start" | "poster" = "start") => {
    const next = SCENES[index]
    const first = from === "poster" ? next.poster : 0
    setSceneIndex(index)
    setStep(first)
    setRun((r) => r + 1)
    elapsed.current = next.steps[first].at
    setBarStart(next.steps[first].at)
    trackHeroSceneChange({ scene: next.id, trigger })
  }, [])

  // The timeline: wait until the next step (or the scene's end), then advance.
  React.useEffect(() => {
    if (paused) return
    const nextAt = step + 1 < scene.steps.length ? scene.steps[step + 1].at : scene.duration
    const wait = Math.max(0, nextAt - elapsed.current)
    const startedAt = performance.now()
    const timer = window.setTimeout(() => {
      elapsed.current = nextAt
      if (step + 1 < scene.steps.length) setStep(step + 1)
      else goTo((sceneIndex + 1) % SCENES.length, "auto")
    }, wait)
    return () => {
      window.clearTimeout(timer)
      // Paused mid-wait: remember how far we got so resuming doesn't restart the gap.
      elapsed.current = Math.min(nextAt, elapsed.current + (performance.now() - startedAt))
    }
  }, [paused, step, scene, sceneIndex, goTo])

  const view = frame(scene, step)

  // The one side effect: press the real Deny button so the card shows its own decided state.
  // The stage is inert, so the component's focus() call is a no-op and the page never scrolls.
  React.useEffect(() => {
    if (scene.id !== "agent" || !view.deny) return
    const deny = stageRef.current?.querySelector<HTMLButtonElement>("[data-slot=agent-action-approve] button")
    deny?.click()
  }, [scene.id, view.deny, run])

  // Measure where the cursor should be, relative to the stage.
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null)
  React.useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (!view.cursor) {
      setCursor(null)
      return
    }
    const target = stage.querySelector<HTMLElement>(view.cursor)
    if (!target) return
    const s = stage.getBoundingClientRect()
    const t = target.getBoundingClientRect()
    const isInput = target.tagName === "INPUT"
    setCursor({ x: t.left - s.left + (isInput ? Math.min(t.width * 0.3, 90) : t.width / 2), y: t.top - s.top + t.height / 2 })
  }, [view.cursor, step, run])

  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let next = index
    if (event.key in keys) next = (index + keys[event.key] + SCENES.length) % SCENES.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = SCENES.length - 1
    else return
    event.preventDefault()
    tabRefs.current[next]?.focus()
    goTo(next, "tab", playing ? "start" : "poster")
  }

  const showPoster = !playing && step === scene.poster
  const Icon = scene.icon

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div className="rounded-[1.1rem] bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.02] p-1.5 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.35)] ring-1 ring-foreground/[0.06] dark:from-white/[0.09] dark:to-white/[0.02] dark:shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)]">
        <div className="overflow-hidden rounded-xl border bg-background">
          {/* Window chrome */}
          <div className="flex h-10 items-center gap-3 border-b px-3">
            <div aria-hidden className="flex shrink-0 gap-1.5">
              <span className="size-2.5 rounded-full bg-foreground/15" />
              <span className="size-2.5 rounded-full bg-foreground/15" />
              <span className="size-2.5 rounded-full bg-foreground/15" />
            </div>
            <div className="mx-auto flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-muted px-2.5 font-mono text-[11px] text-muted-foreground">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-500/80" />
              <span className="truncate">{scene.url}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (playing) return setPlaying(false)
                setPlaying(true)
                if (showPoster || step === scene.steps.length - 1) goTo(sceneIndex, "play")
              }}
              aria-label={playing ? "Pause the demo" : "Play the demo"}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {playing ? <Pause aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}
            </button>
          </div>

          {/* Scene tabs */}
          <div role="tablist" aria-label="Demo scenes" className="grid grid-cols-3 border-b bg-surface/60">
            {SCENES.map((s, i) => {
              const selected = i === sceneIndex
              const TabIcon = s.icon
              return (
                <button
                  key={s.id}
                  ref={(node) => {
                    tabRefs.current[i] = node
                  }}
                  type="button"
                  role="tab"
                  id={`hero-tab-${s.id}`}
                  aria-selected={selected}
                  aria-controls="hero-demo-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => goTo(i, "tab", playing ? "start" : "poster")}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cn(
                    "relative flex h-10 min-w-0 items-center justify-center gap-1.5 px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
                    selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <TabIcon aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{s.tab}</span>
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                    {selected && (
                      <span
                        key={run}
                        className="hero-progress block h-full origin-left rounded-full bg-brand"
                        style={
                          showPoster
                            ? { animationName: "none", transform: "scaleX(1)" }
                            : { animationDuration: `${s.duration}ms`, animationDelay: `-${barStart}ms`, animationPlayState: paused ? "paused" : "running" }
                        }
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Stage */}
          <div id="hero-demo-panel" role="tabpanel" aria-labelledby={`hero-tab-${scene.id}`} className="relative">
            <p className="sr-only">{scene.description}</p>
            {!playing && (
              <button
                type="button"
                onClick={() => {
                  setPlaying(true)
                  goTo(sceneIndex, "play")
                }}
                className="absolute top-3 right-3 z-30 inline-flex h-8 items-center gap-1.5 rounded-full border bg-background/95 px-3 text-xs font-medium shadow-sm backdrop-blur outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Play aria-hidden className="size-3" /> Play demo
              </button>
            )}
            <div
              ref={stageRef}
              inert
              aria-hidden
              className="ink-amber bg-dots relative flex h-[23.5rem] items-center justify-center overflow-hidden bg-surface px-4 sm:h-[24.5rem] sm:px-8"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${scene.id}-${run}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)" }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-[22.5rem]"
                >
                  {scene.id === "agent" ? (
                    <AgentActionApprove call={AGENT_CALL} onDecision={noop} className="bg-card text-left shadow-[0_18px_50px_-30px_rgb(0_0_0/0.45)]" />
                  ) : (
                    <div className="rounded-xl border bg-card p-5 text-left shadow-[0_18px_50px_-30px_rgb(0_0_0/0.45)]">
                      <div className="mb-4 flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-lg border bg-background text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium tracking-tight">{scene.title}</span>
                          <span className="block text-xs text-muted-foreground">{scene.id === "amount" ? "To: Sunrise Apartments" : "Free for 14 days"}</span>
                        </span>
                      </div>
                      {scene.id === "amount" ? (
                        <AmountInput
                          label="Monthly rent"
                          locale="en-IN"
                          currency="INR"
                          // The usual amount applies once the figure is rent-sized, so the half-typed "2", "24"… don't flash "Missing a zero?".
                          typical={view.amount !== null && view.amount >= 10000 ? 24000 : undefined}
                          value={view.amount} onValueChange={noop} className="max-w-none" />
                      ) : (
                        <EmailInput
                          label="Work email"
                          value={view.email}
                          onValueChange={noop}
                          delay={200}
                          completeDomains={false}
                          messages={{ typoMessage: "Did you mean", useShort: "" }}
                          className="max-w-none"
                        />
                      )}
                      <div
                        className={cn(
                          "mt-3 flex h-9 items-center justify-center rounded-md text-sm font-medium transition-colors duration-300",
                          view.done ? "bg-primary text-primary-foreground" : "bg-primary/10 text-muted-foreground",
                        )}
                      >
                        {scene.id === "amount" ? "Pay rent" : "Create account"}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Caught-and-fixed badge */}
              <AnimatePresence>
                {view.done && (
                  <motion.div
                    key={`done-${scene.id}-${run}`}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-background/95 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-emerald-700 shadow-sm backdrop-blur dark:text-emerald-400"
                  >
                    <CircleCheck className="size-3.5" />
                    {scene.badge}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fake cursor */}
              <AnimatePresence>
                {cursor && playing && (
                  <motion.div
                    key="cursor"
                    className="pointer-events-none absolute top-0 left-0 z-20"
                    initial={{ opacity: 0, x: cursor.x + 40, y: cursor.y + 50 }}
                    animate={{ opacity: 1, x: cursor.x, y: cursor.y }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20, mass: 0.9 }}
                  >
                    <motion.div animate={view.click && !reduce ? { scale: [1, 0.82, 1] } : { scale: 1 }} transition={{ duration: 0.28 }}>
                      <svg width="18" height="20" viewBox="0 0 18 20" className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_3px_rgb(0_0_0/0.3)]">
                        <path d="M2 1.5v15.2l4.1-3.9 2.7 6.1 2.6-1.1-2.7-6h5.8L2 1.5Z" className="fill-foreground stroke-background" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                    {view.click && !reduce && (
                      <motion.span
                        className="absolute -top-3 -left-3 size-6 rounded-full border-2 border-brand"
                        initial={{ opacity: 0.8, scale: 0.4 }}
                        animate={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 0.5 }}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
