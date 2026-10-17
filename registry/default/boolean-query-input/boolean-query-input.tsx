"use client"

// Bollard UI — boolean-query-input · MIT licence · https://bollard-ui.vercel.app/components/boolean-query-input

import * as React from "react"
import { TextSearch, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { lintQuery, parseQuery, queryParts, tokenizeQuery, type QueryIssue, type QueryIssueKind, type QueryPrecedence } from "./boolean-query"

export * from "./boolean-query"

/** Default messages. `{phrase}`, `{word}`, `{op}`, `{count}` are filled in. */
export const BOOLEAN_QUERY_MESSAGES: Record<QueryIssueKind, { message: string; fix?: string }> & Record<"readsAs" | "meant" | "useMeant" | "keep" | "dismiss" | "andFirst" | "leftToRight", string> = {
  "smart-quotes": { message: "Curly quotes pasted from a document aren't read as quotes.", fix: "Use straight quotes" },
  "unclosed-quote": { message: "This quote is never closed, so everything after it becomes one long phrase.", fix: "Close it after “{phrase}”" },
  brackets: { message: "Only ( ) group terms. [ ] and { } are searched as plain text.", fix: "Use ( )" },
  "stray-close": { message: "There's a ) with no ( before it.", fix: "Remove it" },
  "unclosed-open": { message: "A ( is never closed.", fix: "Close it at the end" },
  "empty-group": { message: "Empty brackets match nothing.", fix: "Remove them" },
  "lowercase-op": { message: "“{word}” in lowercase is searched as a word, not as {op}.", fix: "Make it {op}" },
  "dangling-op": { message: "{op} has nothing to join on one side, so it's ignored.", fix: "Remove {op}" },
  precedence: { message: "" },
  andFirst: "AND runs before OR, so it's grouped as highlighted.",
  leftToRight: "This search reads left to right, so it's grouped as highlighted.",
  meant: "Did you mean",
  useMeant: "Use this",
  keep: "Keep, add brackets",
  readsAs: "Reads as",
  dismiss: "Keep it as typed",
}

const fill = (s: string, d: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => d[k] ?? m)
const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface BooleanQueryInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled query. */
  value?: string
  /** Initial query when uncontrolled. */
  defaultValue?: string
  /** Called with the query on every change and fix. */
  onValueChange?: (value: string) => void
  /** How your search engine groups AND and OR without brackets. LinkedIn and most engines apply AND first. */
  precedence?: QueryPrecedence
  /** Called with the current issues once typing pauses, so a form can hold the search until they're fixed. */
  onIssuesChange?: (issues: QueryIssue[]) => void
  /** Pause in ms before warnings appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Override any message or label. */
  messages?: Partial<typeof BOOLEAN_QUERY_MESSAGES>
}

/**
 * A search box for boolean strings that catches the mistakes that silently
 * return the wrong people: AND/OR mixed without brackets (it shows how the
 * engine will group them and offers the grouping you probably meant), a quote
 * or bracket never closed, curly quotes, [ ] used as brackets, lowercase and/or
 * searched as words and operators with nothing on one side. Every fix is one tap.
 */
export function BooleanQueryInput({
  label = "Search",
  value,
  defaultValue = "",
  onValueChange,
  precedence = "and-first",
  onIssuesChange,
  delay = 600,
  messages,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: BooleanQueryInputProps) {
  const t = { ...BOOLEAN_QUERY_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const [settled, setSettled] = React.useState(defaultValue)
  const [dismissed, setDismissed] = React.useState<string>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const query = value ?? inner
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(query), delay)
    return () => clearTimeout(timer)
  }, [query, delay])

  const issues = React.useMemo(() => lintQuery(settled, precedence), [settled, precedence])
  const issuesRef = React.useRef(onIssuesChange)
  React.useEffect(() => {
    issuesRef.current = onIssuesChange
  })
  React.useEffect(() => issuesRef.current?.(issues), [issues])

  const update = (next: string, settle = false) => {
    if (value === undefined) setInner(next)
    if (settle) setSettled(next)
    onValueChange?.(next)
  }
  const apply = (next: string) => {
    update(next, true)
    inputRef.current?.focus()
  }

  const ready = settled === query
  const visible = ready ? issues.filter((i) => `${i.kind}:${query}` !== dismissed) : []
  const issue = visible[0]
  const parts = React.useMemo(() => queryParts(parseQuery(tokenizeQuery(query), precedence)), [query, precedence])
  const showReadback = parts.some((p) => p.role !== "term" || p.broken)
  const copy = issue && issue.kind !== "precedence" ? t[issue.kind] : undefined

  return (
    <div data-slot="boolean-query-input" className={cn("grid w-full max-w-md gap-1.5", className)}>
      <style>{`@keyframes cui-boolean-query-input-pop{from{opacity:0;transform:scale(1.6)}}`}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => update(e.target.value)}
        onBlur={(e) => {
          setSettled(query)
          onBlur?.(e)
        }}
        aria-describedby={[showReadback && `${inputId}-readback`, `${inputId}-status`, describedBy].filter(Boolean).join(" ")}
        data-warning={issue ? "" : undefined}
        className={field}
        {...props}
      />
      <div className="grid min-h-6 gap-1.5 text-xs">
        {/* Redrawn on every keystroke, so it stays out of the live region. */}
        {showReadback && (
          <div id={`${inputId}-readback`} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-md border bg-muted/40 px-2.5 py-2">
            <span className="mr-0.5 inline-flex items-center gap-1 self-center text-muted-foreground">
              <TextSearch aria-hidden className="size-3.5" /> {t.readsAs}
            </span>
            <span className="font-mono text-[13px] leading-6 break-words">
              {parts.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && !(parts[i - 1].text === "(" && parts[i - 1].role === "paren") && !(p.role === "paren" && p.text === ")") && " "}
                  {p.role === "op" ? (
                    <span className={p.implied ? "text-[11px] text-muted-foreground/70" : "font-semibold text-sky-700 dark:text-sky-400"}>{p.text}</span>
                  ) : p.role === "paren" ? (
                    <span
                      className={cn(
                        p.implied
                          ? "inline-block rounded-sm bg-amber-300/50 px-px font-semibold text-amber-900 motion-safe:animate-[cui-boolean-query-input-pop_300ms_ease-out] dark:bg-amber-400/25 dark:text-amber-200"
                          : "text-muted-foreground"
                      )}
                    >
                      {p.text}
                    </span>
                  ) : (
                    <span className={cn(p.broken && "underline decoration-red-500 decoration-wavy underline-offset-4")}>{p.text}</span>
                  )}
                </React.Fragment>
              ))}
            </span>
          </div>
        )}
        <div id={`${inputId}-status`} aria-live="polite" className="grid gap-1.5">
        {issue && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {issue.kind === "precedence" ? (
                <>
                  <span className="py-1">
                    {precedence === "and-first" ? t.andFirst : t.leftToRight}
                    <span className="sr-only"> ({issue.detail.engine})</span> {t.meant}{" "}
                    <code className="rounded-sm bg-amber-500/10 px-1 font-mono text-amber-900 dark:text-amber-200">{issue.detail.meant}</code>?
                  </span>
                  <button type="button" onClick={() => apply(issue.fix!)} aria-label={`${t.useMeant}: ${issue.detail.meant}`} className={fixClass}>{t.useMeant}</button>
                  <button type="button" onClick={() => apply(issue.keep!)} aria-label={`${t.keep}: ${issue.keep}`} className={fixClass}>{t.keep}</button>
                </>
              ) : (
                <>
                  <span className="py-1">{fill(copy!.message, issue.detail)}</span>
                  {issue.fix !== undefined && copy?.fix && (
                    <button type="button" onClick={() => apply(issue.fix!)} className={fixClass}>
                      <span className="truncate">{fill(copy.fix, issue.detail)}</span>
                    </button>
                  )}
                  {issue.kind === "lowercase-op" && (
                    <button
                      type="button"
                      onClick={() => setDismissed(`${issue.kind}:${query}`)}
                      aria-label={t.dismiss}
                      title={t.dismiss}
                      className="grid size-6 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  )}
                </>
              )}
            </span>
          </p>
        )}
        </div>
      </div>
    </div>
  )
}
