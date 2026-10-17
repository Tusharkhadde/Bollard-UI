"use client"

// Bollard UI — hreflang-check · MIT licence · https://bollard-ui.vercel.app/components/hreflang-check

import * as React from "react"
import { Check, CircleAlert, CircleCheck, Info, Languages, Minus, TriangleAlert, WandSparkles, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyHreflangEdits, checkHreflang, returnMatrix, type HreflangIssue } from "@/registry/default/hreflang-check/hreflang"

export { applyHreflangEdits, checkHreflang, checkHreflangCode, parseHreflang, returnMatrix, type CodeCheck, type HreflangIssue, type HreflangIssueKind, type HreflangPage, type HreflangTag, type TextEdit } from "@/registry/default/hreflang-check/hreflang"

export const HREFLANG_CHECK_MESSAGES = {
  label: "hreflang tags",
  hint: "Paste each page's <link> tags or Link: header under a line with its URL, or a sitemap with <loc>.",
  placeholder: "<!-- https://example.com/en/ -->\n<link rel=\"alternate\" hreflang=\"en\" href=\"https://example.com/en/\" />\n<link rel=\"alternate\" hreflang=\"de\" href=\"https://example.com/de/\" />",
  clean: "No problems. Google can pair every page.",
  problems: "{errors} to fix · {warnings} to review",
  fixAll: "Fix {count}",
  matrix: "Who links to whom",
  matrixRow: "{from} → {to}: {state}",
  yes: "links",
  near: "links to a slightly different URL",
  no: "missing",
  page: "Page {url}",
  unknownPage: "Page without a URL",
  "bad-code": "“{detail}” isn't a valid hreflang code, so Google ignores the tag.",
  "ignored-region": "Google ignores the region in “{detail}” (it isn't an ISO country code), so this tag targets every speaker of the language instead.",
  "region-code": "“{detail}” is a country, not a language. hreflang starts with the language.",
  "unsupported-code": "Google doesn't support “{detail}”. Only ISO 3166-1 regions work, so use a country or the plain language.",
  "suspect-code": "“{detail}” means {to}. If you meant a country, add the language (en-GB, pt-BR).",
  "relative-url": "“{detail}” is relative. hreflang URLs must be absolute, with https://.",
  "duplicate-code": "{detail} points at two different URLs on this page, so Google can't tell which is right.",
  "missing-self": "This page doesn't list itself. Each version must name itself as well as the others.",
  "self-near": "The self-reference “{detail}” isn't this page's exact URL, so it doesn't count.",
  "missing-return": "Doesn't link back to {detail}, so Google ignores the pair.",
  "return-near": "Links back to “{to}”, not {detail}. Google needs the exact URL, so the pair is ignored.",
  "canonical-other-lang": "The canonical points at the {detail} page, which tells Google this page is a copy and drops its hreflang.",
  "canonical-elsewhere": "The canonical points at {detail}, so Google ignores this page's hreflang.",
  "shared-canonical": "Another pasted page has the same canonical, so Google treats one as a copy of the other.",
  "missing-x-default": "No x-default, so visitors whose language you don't cover get whichever page Google picks.",
  "no-generic": "Only regional pages for {detail}. Add a plain-language page for speakers elsewhere.",
  conflict: "{detail} points somewhere else here than on another page ({to}). Every page should list the same set.",
  unchecked: "{detail} linked pages weren't pasted, so their return links can't be checked.",
  "no-url": "Add this page's URL on a line above its tags to check self and return links.",
  media: "Don't combine hreflang with media in one <link>. Google may ignore it.",
  "fix-bad-code": "Use {to}",
  "fix-region-code": "Use {to}",
  "fix-ignored-region": "Use {to}",
  "fix-unsupported-code": "Use {to}",
  "fix-suspect-code": "Use {fix}",
  "fix-relative-url": "Make it absolute",
  "fix-duplicate-code": "Remove this one",
  "fix-missing-self": "Add self ({to})",
  "fix-self-near": "Use the exact URL",
  "fix-missing-return": "Add the return link",
  "fix-return-near": "Use the exact URL",
  "fix-canonical-other-lang": "Point it at this page",
  "fix-canonical-elsewhere": "Point it at this page",
  "fix-missing-x-default": "Add x-default",
}
export type HreflangCheckMessages = typeof HREFLANG_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number | undefined>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
/** "acme.com/de/preise" from "https://acme.com/de/preise". */
const short = (url: string) => url.replace(/^https?:\/\//i, "")

/** Announces `text` only after typing settles, so screen readers don't chatter on every keystroke. */
function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface HreflangCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled text: <link> tags (HTML head or sitemap xhtml:link), grouped under a URL line or <loc> per page. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** URL of the page when only one page's tags are pasted without a URL line. */
  pageUrl?: string
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{detail}`, `{to}`, `{fix}`, `{url}`, `{count}` are filled in. */
  messages?: Partial<HreflangCheckMessages>
}

/**
 * An hreflang checker for one page or a whole set: paste the <link> tags (or
 * a sitemap) and it shows who links to whom, then catches what makes Google
 * silently ignore the tags: missing or near-miss return links, invalid codes
 * like en-UK, relative URLs, no self-reference, no x-default and a canonical
 * that points at another language's page.
 */
export function HreflangCheck({ value, defaultValue = "", onValueChange, pageUrl, label, messages, rows = 6, id, className, ref, "aria-describedby": describedBy, ...props }: HreflangCheckProps) {
  const t = { ...HREFLANG_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const { pages, issues } = React.useMemo(() => checkHreflang(text, pageUrl), [text, pageUrl])
  const matrix = React.useMemo(() => returnMatrix(pages), [pages])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix)
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : pages.length ? t.clean : ""
  const announced = useSettled(summary)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // A fix removes its own button, so focus moves to the next fix (or the editor) instead of the page.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: HreflangIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(applyHreflangEdits(text, issue.fix ?? []))
  }
  const fixAll = () => {
    // Offsets move after every edit, so apply one fix, re-check, repeat.
    let next = text
    for (let round = 0; round < 60; round++) {
      const first = checkHreflang(next, pageUrl).issues.find((issue) => issue.severity !== "info" && issue.fix)
      const applied = first ? applyHreflangEdits(next, first.fix ?? []) : next
      if (applied === next) break
      next = applied
    }
    refocus.current = 0
    update(next)
  }
  const label_ = (url: string) => {
    const page = pages.find((p) => p.url === url)
    const self = page?.tags.find((tag) => tag.rel === "alternate" && tag.href === url && !/^x-default$/i.test(tag.hreflang ?? ""))
    return self?.hreflang ?? short(url)
  }

  return (
    <div data-slot="hreflang-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="flex w-fit items-center gap-1.5 font-medium">
        <Languages aria-hidden className="size-4 text-muted-foreground" />
        {t.label}
      </label>
      <textarea
        ref={textarea}
        id={inputId}
        rows={rows}
        value={text}
        onChange={(event) => update(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-hint`, `${inputId}-status`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 break-all shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {t.hint}
      </p>
      <span role="status" className="sr-only">
        {announced}
      </span>
      <div id={`${inputId}-status`} className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs empty:hidden">
        {summary && (
          <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {fixable.length > 1 && (
          <button type="button" onClick={fixAll} className={fixClass(false)}>
            <WandSparkles aria-hidden className="size-3.5" />
            {fill(t.fixAll, { count: fixable.length })}
          </button>
        )}
      </div>
      {matrix.length > 1 && (
        <section aria-labelledby={`${inputId}-matrix`} className="grid min-w-0 gap-1.5 rounded-md border bg-muted/40 p-3 text-xs">
          <h3 id={`${inputId}-matrix`} className="font-medium text-muted-foreground">
            {t.matrix}
          </h3>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 font-mono">
              <thead>
                <tr>
                  <td />
                  {matrix.map((row) => (
                    <th key={row.url} scope="col" className="max-w-24 truncate px-1 text-left font-medium" title={row.url}>
                      {label_(row.url)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.url}>
                    <th scope="row" className="max-w-24 truncate pr-1 text-left font-medium" title={row.url}>
                      {label_(row.url)}
                    </th>
                    {row.cells.map((cell, index) => {
                      const Icon = cell === "yes" ? Check : cell === "near" ? Minus : X
                      const to = label_(matrix[index].url)
                      return (
                        <td key={index} title={fill(t.matrixRow, { from: label_(row.url), to, state: t[cell] })}>
                          <span className={cn("flex size-6 items-center justify-center rounded-md border", cell === "yes" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400")}>
                            <Icon aria-hidden className="size-3.5" />
                            <span className="sr-only">{fill(t.matrixRow, { from: label_(row.url), to, state: t[cell] })}</span>
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div ref={list} className="grid gap-2">
        {pages.map((page, index) => {
          const own = issues.filter((issue) => issue.page === index)
          if (!own.length) return null
          const name = page.url ? fill(t.page, { url: short(page.url) }) : t.unknownPage
          return (
            <section key={index} aria-label={name} className="grid min-w-0 gap-1.5 rounded-md border p-3 text-xs">
              <h3 className="truncate font-mono text-sm font-medium" title={page.url}>
                {page.url ? short(page.url) : t.unknownPage}
              </h3>
              <ul className="grid gap-1.5">
                {own.map((issue, n) => {
                  const Icon = icons[issue.severity]
                  const values = { detail: issue.detail, to: issue.to, fix: issue.fix?.[0]?.text.trim() }
                  const action = fill(t[`fix-${issue.kind}` as keyof HreflangCheckMessages] ?? "", values)
                  return (
                    <li key={`${issue.kind}-${issue.detail ?? ""}-${n}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                      <span className="flex h-6 shrink-0 items-center">
                        <Icon aria-hidden className="size-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="py-1 [overflow-wrap:anywhere]">{fill(t[issue.kind], values)}</span>
                        {issue.fix && action && (
                          <button type="button" data-fix="" aria-label={`${action}: ${name}`} title={issue.fix.map((edit) => edit.text.trim()).filter(Boolean).join("\n") || undefined} onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                            {action}
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
