"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, CircleX, ScanLine, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { parseMrz, type MrzField, type MrzIssue, type MrzResult } from "./mrz"

export { checkDigit, cleanMrz, parseMrz, type MrzField, type MrzFields, type MrzIssue, type MrzResult } from "./mrz"

/** Every visible string. `{…}` placeholders are filled in. */
export const MRZ_MESSAGES = {
  label: "Passport MRZ",
  hint: "Paste or type the two lines of letters and < at the bottom of the photo page.",
  line: "Line {n}: {count}/44",
  name: "Name",
  number: "Passport no.",
  nationality: "Nationality",
  birthDate: "Date of birth",
  expiryDate: "Expires",
  sex: "Sex",
  sexes: { M: "Male", F: "Female", X: "Unspecified", "<": "Unspecified" } as Record<string, string>,
  checked: "check digit OK",
  failed: "check digit wrong",
  pending: "check digit OK only after the fix below",
  length: "A passport MRZ is 2 lines of 44 characters. This has {lengths}.",
  padLine: "Fill line 1 with <",
  idCard: "This looks like an ID card ({format}), not a passport. Paste the passport's two 44-character lines.",
  swapped: "The lines are in the wrong order: the line starting with P comes first.",
  swap: "Swap lines",
  notPassport: "Line 1 starts with {code}. A passport MRZ starts with P.",
  badChar: "Line {line} has \"{char}\" at position {position}. An MRZ only has A–Z, 0–9 and <.",
  ocrDigits: "\"{from}\" in a date or check digit should be \"{to}\": those places are numbers only.",
  ocrLetters: "\"{from}\" in the name or country should be \"{to}\": those places are letters only.",
  ocrFiller: "\"{from}\" here is probably the < filler read as K.",
  ocrSeparator: "No << between surname and given names. Was \"KK\" meant to be <<?",
  useFix: "Use {to}",
  check: "The {field} check digit is {found} but the {field} works out to {expected}.",
  checkComposite: "The final check digit is {found} but the line works out to {expected}.",
  fixDigit: "Make it {to}",
  fixData: "Read {from} as {to}",
  fields: { number: "passport number", birthDate: "date of birth", expiryDate: "expiry date", personalNumber: "personal number", composite: "final" } as Record<MrzField, string>,
  badDate: "{value} isn't a real date ({field}).",
  unknownBirthDate: "Part of the date of birth is unknown (shown as <), which passports are allowed to do. Check what your form expects.",
  birthYear: "{year}, day or month unknown",
  truncated: "The name fills the whole line, so it may be cut short. Check it against the photo page.",
  expired: "This passport expired on {date}.",
  expiresSoon: "This passport expires on {date}, in {days} days. Many countries want 6 months left.",
  valid: "MRZ checks out",
}
export type MrzMessages = typeof MRZ_MESSAGES

const fill = (s: string, v: Record<string, string | number | undefined>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))

export interface MrzPasteInputProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled MRZ text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Called when the parse result changes; `result.valid` is true once every check passes. */
  onParse?: (result: MrzResult) => void
  /** "Today", for the expiry check and the birth-year century. Pass it for deterministic rendering. */
  today?: Date
  /** Locale for dates. */
  locale?: string
  /** Pause in ms before problems are read out after typing. */
  delay?: number
  /** Any visible string; `fields` and `sexes` may be partial. */
  messages?: Partial<Omit<MrzMessages, "fields" | "sexes">> & { fields?: Partial<MrzMessages["fields"]>; sexes?: Partial<MrzMessages["sexes"]> }
}

/**
 * Turns a pasted or typed passport MRZ (ICAO 9303 TD3) into checked fields so a booking or KYC form never
 * stores a misread passport number or date. It verifies every check digit, catches OCR slips (O for 0, K for <,
 * swapped lines, CRLF and stray spaces), proposes the likeliest fix for a wrong check digit and flags an
 * expired or soon-expiring passport.
 */
export function MrzPasteInput({
  value, defaultValue = "", onValueChange, onParse, today, locale = "en-IN", delay = 700, messages,
  className, id: idProp, "aria-describedby": describedBy, ...props
}: MrzPasteInputProps) {
  const t = { ...MRZ_MESSAGES, ...messages, fields: { ...MRZ_MESSAGES.fields, ...messages?.fields }, sexes: { ...MRZ_MESSAGES.sexes, ...messages?.sexes } }
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const now = React.useMemo(() => today ?? new Date(), [today])
  const result = React.useMemo(() => parseMrz(text, now), [text, now])
  const rootRef = React.useRef<HTMLDivElement>(null)
  const areaRef = React.useRef<HTMLTextAreaElement>(null)
  const [status, setStatus] = React.useState("")
  const autoId = React.useId()
  const id = idProp ?? `${autoId}-mrz`

  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(Date.parse(iso)) : "—")
  const commit = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  /** After a fix, go to the next fix, else back to the field. */
  const applyFix = (fixed: string) => {
    commit(fixed)
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? areaRef.current)?.focus())
  }
  const fix = (label: string, fixed: string) => (
    <button key={label} type="button" data-fix onClick={() => applyFix(fixed)}
      className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200">
      {label}
    </button>
  )

  const render = (issue: MrzIssue): [string, React.ReactNode[]] => {
    switch (issue.kind) {
      case "length": return [fill(t.length, { lengths: issue.lengths.join(" + ") }), issue.fixed ? [fix(t.padLine, issue.fixed)] : []]
      case "idCard": return [fill(t.idCard, { format: issue.format }), []]
      case "swapped": return [t.swapped, [fix(t.swap, issue.fixed)]]
      case "notPassport": return [fill(t.notPassport, { code: issue.code }), []]
      case "badChar": return [fill(t.badChar, { line: issue.line, position: issue.position, char: issue.char }), []]
      case "ocr": {
        const msg = issue.what === "digits" ? t.ocrDigits : issue.what === "letters" ? t.ocrLetters : issue.certain ? t.ocrFiller : t.ocrSeparator
        return [fill(msg, { from: issue.from, to: issue.to }), [fix(fill(t.useFix, { to: issue.to }), issue.fixed)]]
      }
      case "check": {
        const msg = fill(issue.field === "composite" ? t.checkComposite : t.check, { field: t.fields[issue.field], found: issue.found, expected: issue.expected })
        return [msg, issue.fixes.map((f) => fix(fill(f.change === "digit" ? t.fixDigit : t.fixData, f), f.fixed))]
      }
      case "badDate": return [fill(t.badDate, { value: issue.value, field: t.fields[issue.field] }), []]
      case "unknownBirthDate": return [t.unknownBirthDate, []]
      case "truncated": return [t.truncated, []]
      case "expired": return [fill(t.expired, { date: date(issue.date) }), []]
      case "expiresSoon": return [fill(t.expiresSoon, { date: date(issue.date), days: issue.days }), []]
    }
  }

  const parseKey = JSON.stringify(result)
  const onParseRef = React.useRef(onParse)
  onParseRef.current = onParse
  React.useEffect(() => {
    if (text) onParseRef.current?.(JSON.parse(parseKey) as MrzResult)
  }, [parseKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const spoken = text ? (result.issues.length ? result.issues.map((i) => render(i)[0]).join(" ") : t.valid) : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(spoken), delay)
    return () => clearTimeout(timer)
  }, [spoken, delay])

  const badDates = new Set<string>(result.issues.flatMap((i) => (i.kind === "badDate" ? [i.field] : [])))
  const state = (check: MrzField) => (badDates.has(check) ? "fail" : result.checks[check] ?? "fail")
  const unknownDob = result.issues.find((i) => i.kind === "unknownBirthDate")
  const f = result.fields
  const row = (label: string, content: React.ReactNode, check?: MrzField, bad?: boolean) => (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("flex min-w-0 items-center gap-1 font-medium break-words", bad && "text-red-700 dark:text-red-400")}>
        <span className="min-w-0">{content}</span>
        {check && (state(check) === "fail"
          ? <CircleX role="img" aria-label={t.failed} className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
          : state(check) === "pending"
            ? <CircleAlert role="img" aria-label={t.pending} className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            : <CircleCheck role="img" aria-label={t.checked} className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />)}
      </dd>
    </div>
  )
  const lines = result.lines.length ? result.lines : [""]
  const expired = result.issues.some((i) => i.kind === "expired")

  return (
    <div ref={rootRef} data-slot="mrz-paste-input" data-state={!text ? "empty" : result.valid ? (expired ? "expired" : "valid") : "invalid"} className={cn("grid w-full max-w-md min-w-0 gap-2 text-sm", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 font-medium">
        <ScanLine aria-hidden className="size-4 text-muted-foreground" />
        {t.label}
      </label>
      <textarea
        ref={areaRef}
        id={id}
        rows={2}
        wrap="off"
        spellCheck={false}
        autoCapitalize="characters"
        autoComplete="off"
        value={text}
        aria-invalid={(!!text && !result.valid) || undefined}
        aria-describedby={cn(`${autoId}-hint`, text && `${autoId}-res`, describedBy) || undefined}
        onChange={(e) => commit(e.target.value)}
        className="min-h-16 w-full min-w-0 resize-none overflow-x-auto rounded-md border bg-transparent px-3 py-2 font-mono text-xs leading-5 tracking-wide uppercase shadow-xs outline-none placeholder:normal-case focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        {...props}
      />
      <p id={`${autoId}-hint`} className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{t.hint}</span>
        {text && (
          <span className="tabular-nums">
            {lines.slice(0, 3).map((l, i) => (
              <span key={i} className={cn("mr-2", l.length !== 44 && "text-amber-700 dark:text-amber-400")}>{fill(t.line, { n: i + 1, count: l.length })}</span>
            ))}
          </span>
        )}
      </p>

      {text && (
        <div id={`${autoId}-res`} className="grid gap-2">
          {f && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md bg-muted/50 px-3 py-2">
              <div className="col-span-2">{row(t.name, `${f.surname}${f.givenNames ? `, ${f.givenNames}` : ""}` || "—")}</div>
              {row(t.number, <span className="font-mono">{f.number || "—"}</span>, "number")}
              {row(t.nationality, f.nationality || "—")}
              {row(t.birthDate, unknownDob?.kind === "unknownBirthDate" && unknownDob.year ? fill(t.birthYear, { year: unknownDob.year }) : date(f.birthDate), "birthDate")}
              {row(t.expiryDate, date(f.expiryDate), "expiryDate", expired)}
              {row(t.sex, t.sexes[f.sex] ?? f.sex)}
            </dl>
          )}
          {result.issues.length > 0 ? (
            <ul className="grid gap-2">
              {result.issues.map((issue, i) => {
                const [msg, fixes] = render(issue)
                const red = issue.kind === "expired"
                const Icon = red ? CircleX : TriangleAlert
                return (
                  <li key={`${issue.kind}-${i}`} className={cn("flex gap-1.5 text-xs", red ? "font-medium text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                    <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 space-y-1">
                      <span className="block break-words">{msg}</span>
                      {fixes.length > 0 && <span className="flex flex-wrap gap-2">{fixes}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" />{t.valid}</p>
          )}
        </div>
      )}
      <span aria-live="polite" className="sr-only">{status}</span>
    </div>
  )
}
