"use client"

import * as React from "react"
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react"
import { CircleCheck, CircleDashed, Loader2, Undo2 } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { matchTyped, rankOptions, type ComboOption } from "./match"

export { editDistance, foldText, matchTyped, rankOptions, type ComboOption, type TypedMatch } from "./match"

/** Every visible string. `{text}`, `{label}` and `{count}` are filled in where noted. */
export const COMMIT_COMBOBOX_MESSAGES = {
  placeholder: "Start typing, then pick from the list",
  /** `{label}` */
  picked: "Picked {label}",
  /** `{label}`: an exact match (ignoring case and accents) picked on leaving the field. */
  autoPicked: "Matched to {label}",
  /** `{label}`: the text was edited after a pick, so the pick was dropped. */
  drifted: "You edited the text, so {label} is no longer selected.",
  undo: "Undo",
  /** `{text}` */
  didYouMean: "“{text}” isn't on the list, so nothing is saved. Did you mean",
  /** `{text}` */
  noMatch: "“{text}” isn't on the list, so nothing is saved. Pick one of the suggestions.",
  /** `{text}`, `{count}` */
  several: "{count} options are called “{text}”. Which one?",
  notPicked: "Nothing picked yet",
  loading: "Searching…",
  empty: "No matches",
  failed: "Couldn't load suggestions. Keep typing to retry.",
}
export type CommitComboboxMessages = typeof COMMIT_COMBOBOX_MESSAGES

export interface CommitComboboxProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label: string
  /** The options to pick from. Ignored when `loadOptions` is set. */
  options?: readonly ComboOption[]
  /** Fetches options for a query (debounced, aborted and ignored once stale). */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<ComboOption[]>
  /** Controlled pick: the option, or null when nothing is picked. */
  value?: ComboOption | null
  /** Initial pick when uncontrolled. */
  defaultValue?: ComboOption | null
  /** Called with the picked option, or null when the pick is dropped. */
  onValueChange?: (option: ComboOption | null) => void
  /** Unpicked text to start with (a restored draft). It is checked as if the user had just left the field. */
  defaultInputValue?: string
  /** Override any text (see `COMMIT_COMBOBOX_MESSAGES`). */
  messages?: Partial<CommitComboboxMessages>
}

type Issue = { text: string; exact: ComboOption[]; near: ComboOption[] }
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
const chipClass =
  "inline-flex h-6 max-w-full items-center truncate rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A pick-from-list field that never lets typed text pass for a pick. Text left unpicked is
 * matched on blur (an exact match is picked, a misspelling gets "Did you mean"), editing after
 * a pick visibly drops it with an Undo (or Esc), and the stored option is always read back.
 */
export function CommitCombobox({
  label,
  options = [],
  loadOptions,
  value,
  defaultValue = null,
  onValueChange,
  defaultInputValue,
  messages,
  id,
  className,
  onKeyDown,
  "aria-describedby": describedBy,
  ...props
}: CommitComboboxProps) {
  const say = { ...COMMIT_COMBOBOX_MESSAGES, ...messages }
  const reduce = useReducedMotion()
  const [inner, setInner] = React.useState(defaultValue)
  const picked = value === undefined ? inner : value
  const [text, setText] = React.useState(defaultInputValue ?? picked?.label ?? "")
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [issue, setIssue] = React.useState<Issue | null>(() =>
    defaultInputValue?.trim() && defaultInputValue !== picked?.label ? { text: defaultInputValue.trim(), ...matchTyped(defaultInputValue, options) } : null,
  )
  const [dropped, setDropped] = React.useState<ComboOption | null>(null)
  const [auto, setAuto] = React.useState(false)
  const [remote, setRemote] = React.useState<{ query: string; items: ComboOption[]; state: "idle" | "loading" | "error" }>({ query: "", items: [], state: "idle" })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`

  // A parent that changes the pick also changes the text.
  const [lastPicked, setLastPicked] = React.useState(picked)
  if (picked !== lastPicked) {
    setLastPicked(picked)
    if (picked && picked.label !== text) setText(picked.label)
  }

  React.useEffect(() => {
    if (!loadOptions || !open) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setRemote((r) => ({ ...r, state: "loading" }))
      loadOptions(text, controller.signal).then(
        (items) => !controller.signal.aborted && setRemote({ query: text, items: Array.isArray(items) ? items : [], state: "idle" }),
        () => !controller.signal.aborted && setRemote((r) => ({ ...r, state: "error" })),
      )
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [loadOptions, open, text])

  const pool = loadOptions ? remote.items : options
  const results = loadOptions ? remote.items : rankOptions(text, options)
  const committed = !!picked && picked.label === text

  const setPick = (option: ComboOption | null) => {
    if (value === undefined) setInner(option)
    onValueChange?.(option)
  }
  const pick = (option: ComboOption, automatic = false) => {
    setPick(option)
    setText(option.label)
    setOpen(false)
    setIssue(null)
    setDropped(null)
    setAuto(automatic)
    if (!automatic) inputRef.current?.focus()
  }
  const undo = () => {
    if (dropped) pick(dropped)
  }

  const settle = () => {
    setOpen(false)
    if (committed || !text.trim()) return setIssue(null)
    const match = matchTyped(text, picked ? [picked, ...pool] : pool)
    if (match.exact.length === 1) pick(match.exact[0], true)
    else setIssue({ text: text.trim(), ...match })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) return setOpen(true)
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((i) => (results.length ? (i + step + results.length) % results.length : 0))
    } else if (event.key === "Enter" && open && results[active]) {
      event.preventDefault()
      pick(results[active])
    } else if (event.key === "Escape") {
      if (open) setOpen(false)
      else if (dropped) undo()
      else return
      event.preventDefault()
    }
  }

  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`
          elements.floating.style.maxHeight = `${Math.max(120, Math.min(288, availableHeight))}px`
        },
      }),
    ],
  })

  const showList = open && (results.length > 0 || remote.state !== "idle" || !!text.trim())
  const chips = issue ? (issue.exact.length > 1 ? issue.exact : issue.near) : []
  const status = committed
    ? fill(auto ? say.autoPicked : say.picked, { label: picked.label })
    : issue
      ? issue.exact.length > 1
        ? fill(say.several, { text: issue.text, count: String(issue.exact.length) })
        : fill(issue.near.length ? say.didYouMean : say.noMatch, { text: issue.text })
      : dropped
        ? fill(say.drifted, { label: dropped.label })
        : say.notPicked
  const warn = !committed && (!!issue || !!dropped)
  const slide = reduce ? { initial: false as const } : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { type: "spring" as const, stiffness: 480, damping: 34 } }

  return (
    <div data-slot="commit-combobox" className={cn("grid w-full max-w-sm min-w-0 gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div ref={refs.setReference} className="relative">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          aria-invalid={warn || undefined}
          aria-describedby={cn(`${inputId}-status`, describedBy)}
          autoComplete="off"
          spellCheck={false}
          placeholder={say.placeholder}
          value={text}
          onChange={(event) => {
            const next = event.target.value
            setText(next)
            setOpen(true)
            setActive(0)
            setIssue(null)
            setAuto(false)
            if (picked && next !== picked.label) {
              setDropped(picked)
              setPick(null)
            }
          }}
          onClick={() => setOpen(true)}
          onBlur={settle}
          onKeyDown={handleKeyDown}
          data-warning={warn ? "" : undefined}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
          {...props}
        />
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
          {remote.state === "loading" ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
          ) : committed ? (
            <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CircleDashed className={cn("size-4", warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
          )}
        </span>
      </div>
      <AnimatePresence>
        {showList && (
          <motion.ul
            ref={refs.setFloating}
            style={floatingStyles}
            id={listId}
            role="listbox"
            aria-label={label}
            {...slide}
            className="z-50 overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          >
            {results.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(index)}
                className="cursor-default truncate rounded-sm px-2 py-1.5 aria-selected:bg-accent"
              >
                {option.label}
              </li>
            ))}
            {results.length === 0 && (
              <li role="presentation" className="px-2 py-1.5 text-muted-foreground">
                {remote.state === "loading" ? say.loading : remote.state === "error" ? say.failed : say.empty}
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
      <LayoutGroup id={inputId}>
        <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={status}
              {...slide}
              className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", committed ? "text-emerald-700 dark:text-emerald-400" : warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}
            >
              {committed ? (
                <span className="py-1 [overflow-wrap:anywhere]">
                  {(auto ? say.autoPicked : say.picked).split("{label}")[0]}
                  <motion.span layoutId={reduce ? undefined : `${inputId}-${picked.value}`} className="inline-block font-semibold">
                    {picked.label}
                  </motion.span>
                  {(auto ? say.autoPicked : say.picked).split("{label}")[1]}
                </span>
              ) : (
                <span className="py-1 [overflow-wrap:anywhere]">{status}</span>
              )}
              {chips.map((option) => (
                <motion.button
                  key={option.value}
                  layoutId={reduce ? undefined : `${inputId}-${option.value}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                  className={chipClass}
                >
                  {option.label}
                </motion.button>
              ))}
              {dropped && (
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={undo} className={cn(chipClass, "gap-1")} aria-keyshortcuts="Escape">
                  <Undo2 aria-hidden className="size-3.5" />
                  {say.undo}
                </button>
              )}
            </motion.p>
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </div>
  )
}
