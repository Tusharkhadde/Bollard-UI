"use client"

import * as React from "react"
import { CircleCheck, IdCard, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkPanName, compareNames, nameTokens, notLatin, recordConflicts, type IdRecord, type MatchLevel, type NameComparison, type PanNameFinding } from "./name-match"

export { PAN_HOLDER_TYPES, checkPanName, compareNames, nameTokens, notLatin, recordConflicts, type IdRecord, type MatchLevel, type NameComparison, type PanNameFinding, type RecordConflict } from "./name-match"

/** Every visible string. `{doc}`, `{words}`, `{letter}`, `{holder}`, `{word}`, `{a}`, `{b}` and `{docs}` are filled in. */
export const KYC_NAME_MATCH_MESSAGES = {
  label: "Full name",
  hint: "Exactly as on your documents",
  levels: { exact: "Matches", order: "Small difference", initials: "Small difference", missing: "Small difference", spelling: "Small difference", different: "Won't match" } as Record<MatchLevel, string>,
  order: "Same words in a different order.",
  initials: "You use initials for {words}.",
  initialsDoc: "{doc} uses initials for {words}.",
  missingDoc: "{doc} also has {words}.",
  missingDocInitial: "{doc} also has the initial {words}.",
  missingYours: "Yours adds {words}, which {doc} doesn't have.",
  spelling: "Spelt differently: {words}.",
  different: "A different name.",
  useName: "Use this name",
  panOk: "PAN: {holder}; 5th letter {letter} matches {word}.",
  panSurnameElsewhere: "Your PAN's 5th letter is {letter}, so it was issued with {word} as the surname. Where a form asks for a surname, use {word}.",
  panNoWord: "Your PAN's 5th letter is {letter}, but no part of this name starts with {letter}. Check that it's your PAN.",
  panFormat: "This PAN isn't in the AAAAA9999A format.",
  panHolder: "{letter} isn't a PAN holder type, so this PAN can't be right.",
  dob: "{a} and {b} have different dates of birth. Verification fails until one is corrected.",
  gender: "{a} and {b} have different genders. Verification fails until one is corrected.",
  summaryFail: "This will likely fail checks against {docs}. Use the name exactly as on {first}, or correct the document first.",
  summaryMinor: "Small differences usually mean an extra step, like an Aadhaar OTP or a bank asking you to update your name.",
  summaryConflict: "The name is close enough, but fix the date of birth or gender first: verification compares them exactly.",
  summaryOk: "Matches every document.",
  latinOnly: "Type your name in English letters, exactly as printed on your documents.",
  used: "Name set to {name}.",
  and: " and ",
}

export type KycNameMatchMessages = typeof KYC_NAME_MATCH_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const title = (w: string) => w.charAt(0) + w.slice(1).toLowerCase()
const list = (words: string[], and: string) => words.map(title).join(and)

const fixClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface KycNameMatchProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "size"> {
  /** Controlled name as the user will submit it. */
  value?: string
  /** Initial name when uncontrolled. */
  defaultValue?: string
  /** Called on typing and one-tap fixes. */
  onValueChange?: (name: string) => void
  /** Names as printed on each document (from OCR, DigiLocker, a PAN or bank lookup), most authoritative first. */
  records: IdRecord[]
  /** Class for the outer wrapper; `className` goes on the input. */
  wrapperClassName?: string
  /** Any visible string. */
  messages?: Partial<KycNameMatchMessages>
}

/**
 * Stops a KYC form being submitted with a name that won't match the documents it is checked against. It compares the
 * typed name with each document word by word (order, initials, a missing middle name, transliteration like Laxmi and
 * Lakshmi), checks the PAN's 5th letter against the surname, flags date of birth or gender that differ between
 * documents, and offers each document's name in one tap.
 */
export function KycNameMatch({ value, defaultValue, onValueChange, records, wrapperClassName, messages, className, id: idProp, "aria-describedby": describedBy, ...props }: KycNameMatchProps) {
  const t = { ...KYC_NAME_MATCH_MESSAGES, ...messages, levels: { ...KYC_NAME_MATCH_MESSAGES.levels, ...messages?.levels } }
  const [inner, setInner] = React.useState(defaultValue ?? "")
  const [status, setStatus] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const autoId = React.useId()
  const id = idProp ?? autoId
  const name = typeof value === "string" ? value : inner
  const docs = (Array.isArray(records) ? records : []).filter((r): r is IdRecord => !!r && typeof r === "object" && typeof r.name === "string").slice(0, 8)
  const typed = nameTokens(name).length > 0

  const results = docs.map((doc) => ({ doc, cmp: compareNames(name, doc.name) }))
  const pan = docs.find((d) => d.pan)
  const panFinding = pan ? checkPanName(pan.pan, typed ? name : pan.name) : null
  const conflicts = recordConflicts(docs)
  const labelOf = (docId: string) => docs.find((d) => d.id === docId)?.label ?? docId
  const failing = typed ? results.filter((r) => r.cmp.level === "different") : []
  const minor = typed && results.some((r) => r.cmp.level !== "exact" && r.cmp.level !== "different")
  const panBad = panFinding && panFinding.kind !== "ok" && panFinding.kind !== "surnameElsewhere"
  const severity = failing.length || conflicts.length || panBad ? "fail" : minor || panFinding?.kind === "surnameElsewhere" ? "minor" : typed ? "ok" : "empty"

  const explain = (cmp: NameComparison, doc: IdRecord) => {
    switch (cmp.level) {
      case "exact": return ""
      case "order": return t.order
      case "initials": {
        const x = nameTokens(name)
        const y = nameTokens(doc.name)
        const yours = y.filter((w, i) => x[i]?.length === 1 && w.length > 1)
        return yours.length ? fill(t.initials, { words: list(yours, t.and) }) : fill(t.initialsDoc, { doc: doc.label, words: list(x.filter((w, i) => y[i]?.length === 1 && w.length > 1), t.and) })
      }
      case "missing": return fill(cmp.extra?.side === "b" ? (cmp.extra.words.every((w) => w.length === 1) ? t.missingDocInitial : t.missingDoc) : t.missingYours, { doc: doc.label, words: list(cmp.extra?.words ?? [], t.and) })
      case "spelling": return fill(t.spelling, { words: list(cmp.differing, t.and) })
      case "different": return t.different
    }
  }
  const panText = (f: PanNameFinding) => {
    switch (f.kind) {
      case "ok": return fill(t.panOk, { holder: f.holder, letter: f.letter, word: title(f.word) })
      case "surnameElsewhere": return fill(t.panSurnameElsewhere, { letter: f.letter, word: title(f.word) })
      case "noWord": return fill(t.panNoWord, { letter: f.letter })
      case "format": return t.panFormat
      case "holder": return fill(t.panHolder, { letter: f.letter })
    }
  }
  const summary = notLatin(name) ? t.latinOnly
    : severity === "fail" && !failing.length && !panBad ? t.summaryConflict
      : severity === "fail" ? fill(t.summaryFail, { docs: (failing.length ? failing.map((r) => r.doc.label) : docs.map((d) => d.label)).join(", "), first: docs[0]?.label ?? "" })
      : severity === "minor" ? t.summaryMinor : severity === "ok" ? t.summaryOk : ""

  // One hidden status, debounced, so typing isn't read out keystroke by keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])

  const commit = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const use = (doc: IdRecord) => {
    const next = doc.name.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ")
    commit(next)
    setStatus(fill(t.used, { name: next }))
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? inputRef.current)?.focus())
  }

  const tone = { fail: "text-red-700 dark:text-red-400", minor: "text-amber-800 dark:text-amber-300", ok: "text-emerald-700 dark:text-emerald-400", empty: "text-amber-800 dark:text-amber-300" }[severity]

  return (
    <div ref={rootRef} data-slot="kyc-name-match" data-state={severity} className={cn("w-full max-w-md space-y-3", wrapperClassName)}>
      <div>
        <label htmlFor={id} className="text-sm font-medium">{t.label}</label>
        <input
          ref={inputRef}
          id={id}
          value={name}
          onChange={(e) => commit(e.target.value.slice(0, 200))}
          autoComplete="name"
          spellCheck={false}
          aria-invalid={failing.length > 0 || !!panBad || undefined}
          aria-describedby={[describedBy, `${id}-hint`, summary ? `${id}-summary` : ""].filter(Boolean).join(" ")}
          className={cn("mt-1.5 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 md:text-sm", className)}
          {...props}
        />
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{t.hint}</p>
      </div>

      {docs.length > 0 && (
        <ul className="divide-y rounded-md border bg-card text-sm">
          {results.map(({ doc, cmp }) => {
            const show = typed ? cmp.level : "exact"
            return (
              <li key={doc.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><IdCard aria-hidden className="size-3.5 shrink-0" />{doc.label}</span>
                  {typed && (
                    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium", show === "exact" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : show === "different" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
                      {show === "exact" ? <CircleCheck aria-hidden className="size-3" /> : <TriangleAlert aria-hidden className="size-3" />}
                      {t.levels[show]}
                    </span>
                  )}
                </div>
                <p className="font-medium break-words">
                  {doc.name.trim().split(/\s+/).map((word, i) => {
                    const differs = typed && show !== "exact" && nameTokens(word).some((w) => cmp.differing.includes(w))
                    return <React.Fragment key={i}>{i > 0 && " "}{differs ? <mark className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/25">{word}</mark> : word}</React.Fragment>
                  })}
                </p>
                {typed && show !== "exact" && (
                  <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", show === "different" ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300")}>
                    <span id={`${id}-${doc.id}`} className="min-w-0 flex-1 basis-48 break-words">{explain(cmp, doc)}</span>
                    <button type="button" data-fix onClick={() => use(doc)} aria-describedby={`${id}-${doc.id}`} className={fixClass}>{t.useName}</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {(panFinding || conflicts.length > 0) && (
        <ul className="space-y-1.5 text-xs">
          {panFinding && (
            <li className={cn("flex items-start gap-1.5", panFinding.kind === "ok" ? "text-muted-foreground" : panFinding.kind === "surnameElsewhere" ? "text-amber-800 dark:text-amber-300" : "text-red-700 dark:text-red-400")}>
              {panFinding.kind === "ok" ? <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
              <span className="min-w-0 break-words">{panText(panFinding)}</span>
            </li>
          )}
          {conflicts.map((c) => (
            <li key={c.kind + c.b} className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{fill(c.kind === "dob" ? t.dob : t.gender, { a: labelOf(c.a), b: labelOf(c.b) })}</span>
            </li>
          ))}
        </ul>
      )}

      {summary && <p id={`${id}-summary`} className={cn("text-sm font-medium", tone)}>{summary}</p>}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
