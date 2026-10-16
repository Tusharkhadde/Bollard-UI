"use client"

import * as React from "react"
import { autoUpdate, flip, offset, shift, size, useDismiss, useFloating, useInteractions, useMergeRefs } from "@floating-ui/react"
import { CircleCheck, TriangleAlert, Users } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { distinguishingKeys, findNamesakes, matches, type NamesakeOption } from "./namesake"

export { distinguishingKeys, findNamesakes, matches, nameKey, type NamesakeOption } from "./namesake"

export const NAMESAKE_SELECT_MESSAGES = {
  placeholder: "Search by name",
  empty: "No one matches “{query}”.",
  results: "{count} results.",
  /** Badge on options that share a name. */
  sameName: "{count} named {name}",
  confirm: "{count} people are called {name}. Which {field} is theirs?",
  confirmed: "{name} · {details}",
  others: "Others called {name}: {list}",
  wrong: "{value} is the other {name}.",
  switchTo: "Switch to them",
  pickAgain: "Pick again",
  identical: "{count} records called {name} have identical details. It may be a duplicate record, so check before you continue.",
  useAnyway: "Use this one",
  more: "Showing {shown} of {count}. Keep typing to narrow it down.",
}

export interface NamesakeSelectProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  options: NamesakeOption[]
  /** Selected id (controlled). `null` means none. */
  value?: string | null
  defaultValue?: string | null
  /** Fires with the chosen id, or `null` when the text is edited away. With `verify="reenter"`, a name someone else shares only becomes the value once confirmed. */
  onValueChange?: (id: string | null) => void
  /** `reenter` (default) asks for one identifier when a picked name is shared; `readback` only shows the identifiers. Re-entry cut wrong-patient orders about twice as much as a confirm alert did (Adelman et al., JAMIA 2013). */
  verify?: "reenter" | "readback"
  /** Visible label of the field. */
  label: string
  /** How many identifying details to read back once chosen. Two, as patient-safety practice asks. */
  identifiers?: number
  messages?: Partial<typeof NAMESAKE_SELECT_MESSAGES>
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const chip =
  "inline-flex h-7 items-center rounded-md border bg-background px-2.5 text-xs font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

/**
 * A person or record picker that stops "right name, wrong one" picks: the second Ravi Kumar one row
 * below, the patient with the same name, the customer account with a twin. Options that share a name
 * (ignoring case, accents and word order) are flagged in the list with only the details that tell them
 * apart, highlighted. Picking one asks for one identifier among the namesakes' values (the ID re-entry
 * that halves wrong-record errors), offers a one-tap switch when the answer belongs to the other person,
 * and reads the choice back with two identifiers. Identical twins are called out as a likely duplicate.
 * The list is positioned with Floating UI so it flips and shrinks instead of clipping at the screen edge.
 */
export function NamesakeSelect({
  options,
  value,
  defaultValue = null,
  onValueChange,
  verify = "reenter",
  label,
  identifiers = 2,
  messages,
  className,
  ...props
}: NamesakeSelectProps) {
  const m = { ...NAMESAKE_SELECT_MESSAGES, ...messages }
  const list = Array.isArray(options) ? options.filter((o) => o && typeof o.id === "string") : []
  const byId = new Map(list.map((o) => [o.id, o]))
  const twins = findNamesakes(list)
  const [inner, setInner] = React.useState(defaultValue)
  const selectedId = value !== undefined ? value : inner
  const selected = selectedId ? byId.get(selectedId) : undefined
  const [query, setQuery] = React.useState(selected?.label ?? "")
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [pending, setPending] = React.useState<string | null>(null)
  const [wrong, setWrong] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const quietFocus = React.useRef(false)
  const reduce = useReducedMotion()
  const id = React.useId()

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    strategy: "fixed",
    // left/top instead of a transform, so the open animation's transform doesn't fight the position.
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ rects, availableHeight, elements }) =>
          void Object.assign(elements.floating.style, { width: `${rects.reference.width}px`, maxHeight: `${Math.max(120, Math.min(288, availableHeight))}px` }),
      }),
    ],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss(context)])
  const inputRefs = useMergeRefs([inputRef, refs.setReference])

  const found = list.filter((o) => matches(o, selected && query === selected.label ? "" : query))
  // A long list stays fast and readable: the first 50, and a nudge to narrow it.
  const shown = found.slice(0, 50)
  const activeIndex = Math.min(active, shown.length - 1)

  // One debounced status line: the result count and how many share a name, never per keystroke.
  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setStatus(found.length ? fill(m.results, { count: found.length }) : fill(m.empty, { query })), 600)
    return () => clearTimeout(timer)
  }, [open, found.length, query, m.results, m.empty])

  /** Back to the field after a choice, without reopening the list. */
  const focusInput = () => {
    quietFocus.current = true
    inputRef.current?.focus()
    quietFocus.current = false
  }

  const commit = (option: NamesakeOption | null) => {
    if (value === undefined) setInner(option?.id ?? null)
    onValueChange?.(option?.id ?? null)
    setPending(null)
    setWrong(null)
    if (option) setQuery(option.label)
  }

  const pick = (option: NamesakeOption) => {
    setOpen(false)
    setQuery(option.label)
    if (verify === "readback" || !twins.has(option.id)) {
      commit(option)
      return focusInput()
    }
    // A shared name: hold the pick until one identifier confirms it. Focus moves to the question.
    setPending(option.id)
    setWrong(null)
    requestAnimationFrame(() => cardRef.current?.querySelector<HTMLElement>("button")?.focus())
  }

  const group = (option: NamesakeOption) => [option, ...(twins.get(option.id) ?? [])]
  const pendingOption = pending ? byId.get(pending) : undefined
  const challengeKey = pendingOption && distinguishingKeys(group(pendingOption)).find((k) => new Set(group(pendingOption).map((o) => o.details?.[k])).size === group(pendingOption).length)

  const answer = (choice: NamesakeOption) => {
    if (!pendingOption) return
    if (choice.id === pendingOption.id) {
      commit(pendingOption)
      return focusInput()
    }
    setWrong(choice.id)
    if (!reduce && cardRef.current) animate(cardRef.current, { x: [0, -5, 5, -2, 0] }, { duration: 0.3 })
  }

  const readDetails = (option: NamesakeOption) => {
    const keys = twins.has(option.id) ? distinguishingKeys(group(option)) : []
    const ordered = [...new Set([...keys, ...Object.keys(option.details ?? {})])].slice(0, Math.max(1, identifiers))
    return ordered.filter((k) => option.details?.[k]).map((k) => `${k} ${option.details![k]}`).join(" · ")
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) return setOpen(true)
      setActive((i) => Math.max(0, Math.min(shown.length - 1, Math.min(i, shown.length - 1) + (event.key === "ArrowDown" ? 1 : -1))))
    } else if (event.key === "Enter" && open && shown[activeIndex]) {
      event.preventDefault()
      pick(shown[activeIndex])
    }
  }

  return (
    <div data-slot="namesake-select" data-state={pending ? "confirming" : selected ? "selected" : "empty"} className={cn("grid w-full max-w-sm grid-cols-1 gap-1.5 text-sm", className)} {...props}>
      <label htmlFor={`${id}-input`} className="font-medium">
        {label}
      </label>
      <input
        ref={inputRefs}
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[activeIndex] ? `${id}-${shown[activeIndex].id}` : undefined}
        autoComplete="off"
        placeholder={m.placeholder}
        value={query}
        {...getReferenceProps({
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value)
            setOpen(true)
            setActive(0)
            if (selected || pending) commit(null)
            setPending(null)
          },
          onFocus: () => !quietFocus.current && setOpen(true),
          onClick: () => setOpen(true),
          onKeyDown,
        })}
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
      />
      <AnimatePresence>
        {open && (
          <motion.ul
            ref={refs.setFloating}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            style={floatingStyles}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 600, damping: 40 }}
            {...getFloatingProps()}
            className="z-50 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {shown.length === 0 && <li className="px-2 py-1.5 text-muted-foreground">{fill(m.empty, { query })}</li>}
            {shown.map((option, index) => {
              const others = twins.get(option.id)
              const keys = others ? distinguishingKeys([option, ...others]).slice(0, 2) : Object.keys(option.details ?? {}).slice(0, 1)
              return (
                <li
                  key={option.id}
                  id={`${id}-${option.id}`}
                  role="option"
                  aria-selected={option.id === selectedId}
                  onPointerMove={() => setActive(index)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                  className={cn("grid cursor-default gap-0.5 rounded-sm px-2 py-1.5", index === activeIndex && "bg-accent text-accent-foreground")}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                    {others && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-amber-500/15 px-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                        <Users aria-hidden className="size-3" />
                        {fill(m.sameName, { count: others.length + 1, name: option.label })}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {keys.map((k) => (
                      <span key={k} className={cn(others && "rounded-sm bg-amber-500/10 px-1 text-foreground")}>
                        {k} {option.details?.[k]}
                      </span>
                    ))}
                  </span>
                </li>
              )
            })}
            {found.length > shown.length && (
              <li aria-hidden className="px-2 py-1.5 text-xs text-muted-foreground">
                {fill(m.more, { shown: shown.length, count: found.length })}
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="popLayout">
        {pendingOption && (
          <motion.div
            key="confirm"
            ref={cardRef}
            role="group"
            aria-labelledby={`${id}-question`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-950 dark:text-amber-100"
          >
            {challengeKey ? (
              <>
                <p id={`${id}-question`} className="flex gap-1.5 font-medium">
                  <Users aria-hidden className="mt-px size-3.5 shrink-0" />
                  {fill(m.confirm, { count: group(pendingOption).length, name: pendingOption.label, field: challengeKey.toLowerCase() })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...group(pendingOption)]
                    .sort((a, b) => (a.details?.[challengeKey] ?? "").localeCompare(b.details?.[challengeKey] ?? ""))
                    .map((o) => (
                      <button key={o.id} type="button" onClick={() => answer(o)} className={chip}>
                        {o.details?.[challengeKey]}
                      </button>
                    ))}
                </div>
                {wrong && byId.get(wrong) && (
                  <p role="alert" className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">{fill(m.wrong, { value: byId.get(wrong)!.details?.[challengeKey] ?? "", name: pendingOption.label })}</span>
                    <button type="button" onClick={() => (commit(byId.get(wrong)!), focusInput())} className={chip}>
                      {m.switchTo}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        commit(null)
                        setQuery(pendingOption.label)
                        setOpen(true)
                        focusInput()
                      }}
                      className={chip}
                    >
                      {m.pickAgain}
                    </button>
                  </p>
                )}
              </>
            ) : (
              <>
                <p id={`${id}-question`} className="flex gap-1.5">
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  {fill(m.identical, { count: group(pendingOption).length, name: pendingOption.label })}
                </p>
                <button type="button" onClick={() => (commit(pendingOption), focusInput())} className={cn(chip, "w-fit")}>
                  {m.useAnyway}
                </button>
              </>
            )}
          </motion.div>
        )}
        {!pendingOption && selected && (
          <motion.div
            key={`chosen-${selected.id}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-0.5 text-xs"
          >
            <p className="flex items-start gap-1.5">
              <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{fill(m.confirmed, { name: selected.label, details: readDetails(selected) })}</span>
            </p>
            {twins.has(selected.id) && (
              <p className="pl-5 text-muted-foreground">
                {fill(m.others, { name: selected.label, list: twins.get(selected.id)!.map(readDetails).join("; ") })}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  )
}
