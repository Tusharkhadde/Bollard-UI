"use client"

// Bollard UI — passenger-name-input · MIT licence · https://bollard-ui.vercel.app/components/passenger-name-input

import * as React from "react"
import { ArrowLeftRight, Ticket, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPassengerName, PASSENGER_TITLES, printedName, type IdName, type PassengerIssue, type PassengerName } from "./passenger-name"

export { checkPassengerName, NICKNAMES, PASSENGER_TITLES, printedName, toTicket, type IdName, type PassengerIssue, type PassengerName, type PassengerNameOptions } from "./passenger-name"

/** Every visible string. Issue texts fill in `{word}`, `{typed}`, `{full}`, `{missing}`, `{extra}`, `{chars}`, `{length}`, `{max}`, `{a}` and `{b}`. */
export const PASSENGER_NAME_MESSAGES = {
  legend: "Passenger",
  title: "Title",
  noTitle: "—",
  given: "First and middle names",
  surname: "Last name",
  singleName: "My ID shows only one name",
  printsAs: "Prints on the ticket as",
  printsAsEmpty: "SURNAME/FIRST MIDDLE TITLE",
  count: "{length}/{max}",
  idHint: "Type it exactly as on the ID you'll show at the airport.",
  keep: "Keep it as typed",
  summary: "{count} to check on this name.",
  summaryOne: "1 thing to check on this name.",
  issues: {
    swapped: "First and last name look swapped. Airlines treat this as a name change.",
    title: "“{word}” is a title, not part of the name on your ID.",
    suffix: "“{word}” goes after your last name on a ticket.",
    nickname: "Is “{typed}” the name on the ID? It usually shows {full}.",
    missingName: "Your ID also shows {missing}. Adding it after booking can cost a name-change fee.",
    extraName: "{extra} isn't on your ID.",
    wholeName: "Is “{word}” your last name? It's in the first-name box.",
    singleName: "Only one name? If your ID has no surname, tick “My ID shows only one name”.",
    diacritics: "Tickets can't print accents. Use the spelling in the two lines at the bottom of your passport photo page: {a} or {b}.",
    characters: "Names on tickets can only use letters. Remove {chars}.",
    tooLong: "{length} characters is over the {max} the airline takes. Shorten middle names to initials; your passport details still carry the full name.",
  } as Record<PassengerIssue["kind"], string>,
  fixes: { swapped: "Swap them", title: "Remove it", suffix: "Move it", nickname: "Use {full}", missingName: "Add {missing}", extraName: "Remove it", wholeName: "Move it", singleName: "Only one name", tooLong: "Use initials" } as Partial<Record<PassengerIssue["kind"], string>>,
}

export type PassengerNameMessages = typeof PASSENGER_NAME_MESSAGES

const fill = (template: string, values: Record<string, unknown>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] === undefined ? m : String(values[k])))
const issueKey = (i: PassengerIssue) => `${i.kind}:${"word" in i ? i.word : "typed" in i ? i.typed : "missing" in i ? i.missing : "extra" in i ? i.extra : ""}`

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none dark:text-amber-200"

export interface PassengerNameInputProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Controlled name. */
  value?: PassengerName
  /** Initial name when uncontrolled. */
  defaultValue?: PassengerName
  /** Called with the whole name whenever any part changes. Nothing is rewritten without a tap. */
  onValueChange?: (value: PassengerName) => void
  /** The name exactly as on the passport or ID, when you have it (saved profile, scanned MRZ). Turns guesses into exact fixes. */
  idName?: IdName | null
  /** How a single-name passenger is ticketed: "repeat" (IndiGo: LAKSHMI/LAKSHMI) or "fnu" (IATA AIRIMP, needed for US and Canada: LAKSHMI/FNU). */
  singleNameFormat?: "repeat" | "fnu"
  /** "optional" stops asking for middle names that are on the ID (Air India domestic, for example). Default "required". */
  middleNames?: "required" | "optional"
  /** Longest printed name the airline takes, title included. */
  maxLength?: number
  /** Titles offered in the title box. */
  titles?: string[]
  /** Called whenever the list of open issues changes, to gate the Continue button. */
  onIssuesChange?: (issues: PassengerIssue[]) => void
  /** Pause in ms after typing before issues appear. Leaving a field shows them at once. */
  delay?: number
  /** Any visible string; `issues` and `fixes` may be partial. */
  messages?: Partial<Omit<PassengerNameMessages, "issues" | "fixes">> & { issues?: Partial<PassengerNameMessages["issues"]>; fixes?: PassengerNameMessages["fixes"] }
}

/**
 * A passenger name for flights and trains that must match the ID at the gate. Catches swapped names,
 * a missing middle name, a title or nickname typed into the name, a single-name passenger, accents
 * the ticket can't print and names over the airline's limit, and reads it back as it will print.
 */
export function PassengerNameInput({
  value,
  defaultValue = { title: "", given: "", surname: "" },
  onValueChange,
  idName,
  singleNameFormat = "repeat",
  middleNames = "required",
  maxLength = 59,
  titles = PASSENGER_TITLES,
  onIssuesChange,
  delay = 600,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: PassengerNameInputProps) {
  const t = { ...PASSENGER_NAME_MESSAGES, ...messages, issues: { ...PASSENGER_NAME_MESSAGES.issues, ...messages?.issues }, fixes: { ...PASSENGER_NAME_MESSAGES.fixes, ...messages?.fixes } }
  const [inner, setInner] = React.useState(defaultValue)
  const name: PassengerName = value ?? inner
  const key = JSON.stringify([name?.title, name?.given, name?.surname, !!name?.singleName])
  const [settled, setSettled] = React.useState(key)
  const [kept, setKept] = React.useState<string[]>([])
  const [announcement, setAnnouncement] = React.useState("")
  const rootRef = React.useRef<HTMLFieldSetElement>(null)
  const givenRef = React.useRef<HTMLInputElement>(null)
  const refocus = React.useRef(false)
  const id = React.useId()
  const options = { singleNameFormat, maxLength, titles, id: idName, middleNames }

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(key), delay)
    return () => clearTimeout(timer)
  }, [key, delay])

  const ready = settled === key
  const fresh = React.useMemo(() => (ready ? checkPassengerName(name, options) : null), [ready, key, idName, singleNameFormat, maxLength, titles, middleNames]) // eslint-disable-line react-hooks/exhaustive-deps
  // While typing, keep showing the last checked issues (dimmed) so the form doesn't collapse and jump on every keystroke.
  const [last, setLast] = React.useState<PassengerIssue[]>([])
  React.useEffect(() => {
    if (fresh) setLast(fresh)
  }, [fresh])
  const stale = !fresh
  const issues = (fresh ?? last).filter((i) => !kept.includes(issueKey(i)))
  const summary = issues.length === 0 ? "" : issues.length === 1 ? t.summaryOne : fill(t.summary, { count: issues.length })
  const printed = printedName(name, options)

  React.useEffect(() => {
    if (!stale) onIssuesChange?.(issues)
  }, [stale, JSON.stringify(issues.map(issueKey))]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => setAnnouncement(ready ? summary : ""), [ready, summary])
  React.useEffect(() => {
    if (!refocus.current || !ready) return
    refocus.current = false
    const next = rootRef.current?.querySelector<HTMLButtonElement>("[data-fix]")
    ;(next ?? givenRef.current)?.focus()
  })

  const update = (next: PassengerName, immediate = false) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (immediate) {
      setSettled(JSON.stringify([next.title, next.given, next.surname, !!next.singleName]))
      refocus.current = true
    }
  }
  const settle = () => setSettled(key)
  const warn = issues.length > 0
  const ids = { given: `${id}-given`, surname: `${id}-surname`, title: `${id}-title`, issues: `${id}-issues`, hint: `${id}-hint` }

  const fixButtons = (issue: PassengerIssue) => {
    if (issue.kind === "diacritics")
      return issue.fixes.map((fix, i) => (
        <button key={i} type="button" data-fix disabled={stale} onClick={() => update(fix, true)} className={fixClass}>
          <span className="truncate font-mono">{issue.options[i]}</span>
        </button>
      ))
    if (!("fix" in issue) || !issue.fix) return null
    const fix = issue.fix
    return (
      <button type="button" data-fix disabled={stale} onClick={() => update(fix, true)} className={fixClass}>
        {issue.kind === "swapped" && <ArrowLeftRight aria-hidden className="size-3.5 shrink-0" />}
        <span className="truncate">{fill(t.fixes[issue.kind] ?? "", issue)}</span>
      </button>
    )
  }

  return (
    <fieldset
      ref={rootRef}
      data-slot="passenger-name-input"
      aria-describedby={[describedBy, ids.hint, warn ? ids.issues : ""].filter(Boolean).join(" ")}
      className={cn("@container grid w-full max-w-md min-w-0 gap-3", className)}
      {...props}
    >
      <legend className="mb-1 text-sm font-medium">{t.legend}</legend>
      <p id={ids.hint} className="-mt-2 text-xs text-muted-foreground">{t.idHint}</p>
      <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 @md:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <label htmlFor={ids.title} className="text-xs font-medium">{t.title}</label>
          <select id={ids.title} value={name?.title ?? ""} onChange={(e) => update({ ...name, title: e.target.value })} className={cn(field, "px-2")}>
            <option value="">{t.noTitle}</option>
            {titles.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={ids.given} className="text-xs font-medium">{t.given}</label>
          <input
            ref={givenRef}
            id={ids.given}
            autoComplete="given-name"
            autoCapitalize="words"
            spellCheck={false}
            value={name?.given ?? ""}
            onChange={(e) => update({ ...name, given: e.target.value })}
            onBlur={settle}
            aria-describedby={warn ? ids.issues : undefined}
            data-warning={warn ? "" : undefined}
            className={field}
          />
        </div>
        <div className={cn("col-span-2 grid min-w-0 gap-1.5 @md:col-span-1", name?.singleName && "opacity-50")}>
          <label htmlFor={ids.surname} className="text-xs font-medium">{t.surname}</label>
          <input
            id={ids.surname}
            autoComplete="family-name"
            autoCapitalize="words"
            spellCheck={false}
            disabled={!!name?.singleName}
            value={name?.singleName ? "" : (name?.surname ?? "")}
            onChange={(e) => update({ ...name, surname: e.target.value })}
            onBlur={settle}
            aria-describedby={warn ? ids.issues : undefined}
            data-warning={warn ? "" : undefined}
            className={field}
          />
        </div>
      </div>
      <label className="flex w-fit items-center gap-2 text-sm">
        <input type="checkbox" checked={!!name?.singleName} onChange={(e) => update({ ...name, singleName: e.target.checked }, true)} className="size-4 accent-primary" />
        {t.singleName}
      </label>

      {/* Always rendered so the first keystroke doesn't push the form down. */}
      <div className="grid gap-1 rounded-md border border-dashed bg-muted/40 px-3 py-2">
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Ticket aria-hidden className="size-3.5" />{t.printsAs}</span>
            <span className={cn("tabular-nums", printed.length > maxLength && "font-medium text-amber-700 dark:text-amber-400")}>{fill(t.count, { length: printed.length, max: maxLength })}</span>
          </span>
          <output htmlFor={`${ids.title} ${ids.given} ${ids.surname}`} className={cn("font-mono text-sm font-semibold tracking-wide break-all", !printed && "font-normal text-muted-foreground")}>{printed || t.printsAsEmpty}</output>
        </div>

      {warn && (
        <ul id={ids.issues} data-stale={stale ? "" : undefined} className="grid gap-1.5 text-xs transition-opacity data-stale:opacity-60">
          {issues.map((issue) => (
            <li key={issueKey(issue)} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{fill(t.issues[issue.kind], { ...issue, a: issue.kind === "diacritics" ? issue.options[0] : "", b: issue.kind === "diacritics" ? issue.options[1] : "" })}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {fixButtons(issue)}
                  <button
                    type="button"
                    aria-label={t.keep}
                    title={t.keep}
                    disabled={stale}
                    onClick={() => {
                      setKept((k) => [...k, issueKey(issue)])
                      refocus.current = true
                    }}
                    className="grid size-6 shrink-0 place-items-center rounded-md transition-colors outline-none hover:bg-amber-500/10 disabled:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </fieldset>
  )
}
