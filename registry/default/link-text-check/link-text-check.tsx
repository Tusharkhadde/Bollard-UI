"use client"

import * as React from "react"
import { CircleCheck, Link2, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkLinks, GENERIC_LINK_TEXT, linksFromElement, linksFromMarkdown, normalizeHref, type LinkItem } from "./link-rules"

export { accessibleLinkName, checkLinks, describeHref, GENERIC_LINK_TEXT, isUrlText, linksFromElement, linksFromMarkdown, normalizeHref } from "./link-rules"
export type { LinkCheck, LinkIssue, LinkItem } from "./link-rules"

export const LINK_TEXT_MESSAGES = {
  generic: (text: string) => `“${text}” doesn't say where it goes, and screen reader users often browse links out of context.`,
  url: "A full URL is read out character by character.",
  empty: "No text, so it's announced as just “link”.",
  sameText: (count: number) => `Same text as ${count === 1 ? "a link" : `${count} links`} going somewhere else:`,
}

const fixClass =
  "inline-flex min-h-6 max-w-full items-center rounded-md py-0.5 text-left border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tabClass =
  "h-7 rounded px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:shadow-xs aria-[pressed=false]:text-muted-foreground dark:aria-pressed:bg-input/50"

export interface LinkTextCheckProps extends Omit<React.ComponentProps<"section">, "children"> {
  /** Markdown to check. With `onMarkdownChange`, problems get one-tap rewrites. */
  markdown?: string
  /** Called with the rewritten Markdown when a fix is tapped. */
  onMarkdownChange?: (markdown: string) => void
  /** Live mode: check the links inside this element as it changes. Rows focus the link. */
  target?: React.RefObject<HTMLElement | null>
  /** Called when a link is chosen (markdown mode), e.g. to select it in the editor. */
  onJump?: (link: LinkItem) => void
  /** Text treated as meaningless out of context. Replace it to translate. */
  genericText?: string[]
  title?: string
  /** `{count}` is filled in. */
  summaryText?: string
  allGoodText?: string
  emptyText?: string
  issuesLabel?: string
  listLabel?: string
  listHint?: string
  /** Shown in place of the text of an empty link. */
  emptyLinkText?: string
  /** Prefix a screen reader says before each link. */
  linkRoleText?: string
  /** `{text}` is filled in. */
  fixLabel?: string
  /** Shown instead of a fix in live mode. `{text}` is filled in. */
  tryText?: string
  messages?: Partial<typeof LINK_TEXT_MESSAGES>
}

/**
 * Catches link text that fails people browsing a screen reader's links list: "click here" and "read more",
 * URLs as text, empty links, and one text pointing to two different places. Vague links get a rewrite that lifts
 * the words around them into the link ("To download the report, click here" → "Download the report"), and a
 * second view shows the links list exactly as it will be read out.
 */
export function LinkTextCheck({
  markdown,
  onMarkdownChange,
  target,
  onJump,
  genericText = GENERIC_LINK_TEXT,
  title = "Links",
  summaryText = "{count} to fix",
  allGoodText = "Every link says where it goes",
  emptyText = "No links yet.",
  issuesLabel = "Issues",
  listLabel = "Links list",
  listHint = "How a screen reader's links list reads them, out of context:",
  emptyLinkText = "No text",
  linkRoleText = "link",
  fixLabel = "Use “{text}”",
  tryText = "Try “{text}”",
  messages,
  className,
  ...props
}: LinkTextCheckProps) {
  const [live, setLive] = React.useState<LinkItem[]>([])
  const [view, setView] = React.useState<"issues" | "list">("issues")
  React.useEffect(() => {
    const root = target?.current
    if (!root) return
    // Only re-render when the links really changed, so checking a region that contains this checker can't loop.
    const read = () => {
      const next = linksFromElement(root)
      setLive((current) =>
        current.length === next.length && current.every((l, i) => l.element === next[i].element && l.text === next[i].text && l.href === next[i].href) ? current : next,
      )
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["href", "aria-label", "aria-labelledby", "aria-hidden", "title", "alt", "hidden", "class", "style"] })
    return () => observer.disconnect()
  }, [target])

  const links = React.useMemo(() => (target ? live : linksFromMarkdown(markdown ?? "")), [target, live, markdown])
  const checks = React.useMemo(() => checkLinks(links, genericText), [links, genericText])
  const t = { ...LINK_TEXT_MESSAGES, ...messages }
  const flagged = links.map((link, i) => ({ link, check: checks[i] })).filter((row) => row.check.issue)
  const canFix = !target && !!onMarkdownChange && markdown !== undefined
  const issuesList = React.useRef<HTMLUListElement>(null)
  // A tapped fix removes its card, so focus moves to the next fix (or the first card) instead of the page.
  const refocus = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (refocus.current === null) return
    const fixes = issuesList.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(fixes[Math.min(refocus.current, fixes.length - 1)] ?? issuesList.current?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus()
    refocus.current = null
  }, [markdown])

  const jump = (link: LinkItem) => {
    if (!link.element) return onJump?.(link)
    link.element.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    link.element.focus({ preventScroll: true })
  }
  const message = (link: LinkItem, check: (typeof checks)[number]) =>
    check.issue === "generic" ? t.generic(link.text.trim()) : check.issue === "url" ? t.url : check.issue === "empty" ? t.empty : t.sameText(check.others?.length ?? 1)

  return (
    <section data-slot="link-text-check" data-state={flagged.length ? "issues" : "ok"} aria-label={title} className={cn("w-full max-w-md rounded-lg border p-3 text-sm", className)} {...props}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Link2 aria-hidden className="size-4 text-muted-foreground" />
          {title}
          {links.length > 0 && (
            <span aria-live="polite" className={cn("ms-1 flex items-center gap-1 text-xs font-normal", flagged.length ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
              {flagged.length ? <TriangleAlert aria-hidden className="size-3.5" /> : <CircleCheck aria-hidden className="size-3.5" />}
              {flagged.length ? summaryText.replace("{count}", String(flagged.length)) : allGoodText}
            </span>
          )}
        </p>
        {links.length > 0 && (
          <div className="flex rounded-md bg-muted p-0.5">
            <button type="button" aria-pressed={view === "issues"} onClick={() => setView("issues")} className={tabClass}>{issuesLabel}</button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={tabClass}>{listLabel}</button>
          </div>
        )}
      </div>
      {links.length === 0 && <p className="text-muted-foreground">{emptyText}</p>}
      {view === "list" && links.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">{listHint}</p>
          <ol className="grid list-decimal gap-1 ps-6 text-sm marker:text-xs marker:text-muted-foreground">
            {links.map((link, i) => (
              <li key={i} data-issue={checks[i].issue} className={cn("break-words", checks[i].issue && "text-amber-700 dark:text-amber-400")}>
                <span className="text-muted-foreground">{linkRoleText}, </span>
                {link.text.trim() || "…"}
              </li>
            ))}
          </ol>
        </div>
      )}
      {view === "issues" && (
        <ul ref={issuesList} className="grid gap-2">
          {flagged.map(({ link, check }) => {
            const index = links.indexOf(link)
            const label = link.text.trim()
            return (
              <li key={index} data-issue={check.issue} className="grid min-w-0 gap-1 rounded-md border p-2.5">
                <button type="button" onClick={() => jump(link)} disabled={!link.element && !onJump} className="flex min-w-0 items-baseline gap-2 rounded text-left outline-none enabled:hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <span className={cn("min-w-0 shrink truncate font-medium", !label && "italic text-muted-foreground")}>{label ? `“${label}”` : emptyLinkText}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">→ {normalizeHref(link.href)}</span>
                </button>
                <p className={cn("text-xs", check.issue === "empty" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>{message(link, check)}</p>
                {check.others && (
                  <ul className="grid gap-0.5 ps-3 font-mono text-xs text-muted-foreground">
                    {check.others.map((other) => <li key={other} className="truncate">→ {other}</li>)}
                  </ul>
                )}
                {check.suggestion && (canFix && check.edit ? (
                  <button
                    type="button"
                    data-fix=""
                    className={cn(fixClass, "mt-0.5 min-w-0 justify-self-start")}
                    onClick={(event) => {
                      refocus.current = [...(issuesList.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(event.currentTarget)
                      onMarkdownChange!(markdown!.slice(0, check.edit!.from) + check.edit!.insert + markdown!.slice(check.edit!.to))
                    }}
                  >
                    <span className="break-words">{fixLabel.replace("{text}", check.suggestion)}</span>
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">{tryText.replace("{text}", check.suggestion)}</p>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
