"use client"

import * as React from "react"
import { ChevronsDownUp, Link2Off, Moon, Printer, Scissors, Table, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { A4_CONTENT_WIDTH, applyPrintFixes, printFixCss, scanForPrint, type PrintIssue, type PrintIssueKind } from "./print-scan"

export * from "./print-scan"

const button =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const small = "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

const icons: Record<PrintIssueKind, typeof Moon> = { dark: Moon, collapsed: ChevronsDownUp, wide: Table, clipped: Scissors, links: Link2Off }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** English wording for each issue: what goes wrong on paper, and what the fix does. */
export function describePrintIssue({ kind, count, cut = 0 }: PrintIssue) {
  return {
    dark: { problem: `${plural(count, "dark section", "dark sections")}: light text may print faint or invisible`, fix: "Print that text in black" },
    collapsed: { problem: `${plural(count, "collapsed section won't", "collapsed sections won't")} print`, fix: "Expand them on paper" },
    wide: { problem: `${plural(count, "wide table", "wide tables")}: about ${Math.round(cut * 100)}% is cut off the page`, fix: "Shrink to fit the page" },
    clipped: { problem: `${plural(count, "scroll box prints", "scroll boxes print")} only the part in view`, fix: "Print their full content" },
    links: { problem: `${plural(count, "link prints", "links print")} without an address`, fix: "Write the address after each link" },
  }[kind]
}

export interface PrintGuardProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** What gets printed. Defaults to the whole page. */
  target?: React.RefObject<HTMLElement | null>
  /** Printable width in CSS px. Default: A4 with 1 cm margins (718). Letter is about 739. */
  pageWidth?: number
  /** Ctrl+P / Cmd+P can't be stopped, so apply every fix to those printouts too, then offer a review. */
  autoFix?: boolean
  /** Check as soon as it mounts and show what would be lost, without waiting for a click. */
  checkOnMount?: boolean
  /** Wording per issue; return `problem` and `fix`. */
  describeIssue?: (issue: PrintIssue) => { problem: string; fix: string }
  printLabel?: React.ReactNode
  title?: string
  showLabel?: string
  printFixedLabel?: string
  printAsIsLabel?: string
  cancelLabel?: string
  /** `{count}` is filled in. */
  autoFixedText?: string
  reviewLabel?: string
}

/**
 * Stops the printout that doesn't match the screen. Before printing it checks
 * what paper will lose: light text on dark backgrounds the browser drops,
 * collapsed sections, tables wider than the page (measured at their narrowest),
 * scroll boxes that print only what's in view, and links without their address.
 * Each fix is print-only, so the screen never changes. Ctrl+P can't be
 * intercepted, so those printouts get the fixes automatically and a review after.
 */
export function PrintGuard({
  target,
  pageWidth = A4_CONTENT_WIDTH,
  autoFix = true,
  checkOnMount = false,
  describeIssue = describePrintIssue,
  printLabel = "Print",
  title = "This won't print the way it looks",
  showLabel = "Show",
  printFixedLabel = "Print with fixes",
  printAsIsLabel = "Print as is",
  cancelLabel = "Cancel",
  autoFixedText = "Fixed {count} for that printout.",
  reviewLabel = "Review",
  className,
  ...props
}: PrintGuardProps) {
  const [issues, setIssues] = React.useState<PrintIssue[]>([])
  const [open, setOpen] = React.useState(false)
  const [skipped, setSkipped] = React.useState<Set<PrintIssueKind>>(new Set())
  const [autoFixed, setAutoFixed] = React.useState<number>()
  const revert = React.useRef<(() => void) | null>(null)
  const viaButton = React.useRef(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const printRef = React.useRef<HTMLButtonElement>(null)
  const titleId = React.useId()
  const focusPanel = React.useRef(false)

  const scan = React.useCallback(() => scanForPrint(target?.current ?? document.body, { pageWidth }), [target, pageWidth])

  React.useEffect(() => {
    // beforeprint/afterprint, with the print media query as a backup; the refs make double calls harmless.
    const before = () => {
      if (revert.current || viaButton.current || !autoFix) return
      const found = scan()
      revert.current = applyPrintFixes(found)
      if (found.length) setAutoFixed(found.reduce((sum, issue) => sum + issue.count, 0))
    }
    const after = () => {
      revert.current?.()
      revert.current = null
      viaButton.current = false
    }
    const media = matchMedia("print")
    const onMedia = (event: MediaQueryListEvent) => (event.matches ? before() : after())
    window.addEventListener("beforeprint", before)
    window.addEventListener("afterprint", after)
    media.addEventListener("change", onMedia)
    return () => {
      window.removeEventListener("beforeprint", before)
      window.removeEventListener("afterprint", after)
      media.removeEventListener("change", onMedia)
    }
  }, [autoFix, scan])

  // Focus follows a click on Print, never a check that ran by itself.
  React.useEffect(() => {
    if (open && focusPanel.current) panelRef.current?.focus()
    focusPanel.current = false
  }, [open])

  const print = (fixes: PrintIssue[]) => {
    setOpen(false)
    setAutoFixed(undefined)
    viaButton.current = true
    revert.current = applyPrintFixes(fixes)
    window.print()
  }
  const review = () => {
    const found = scan()
    setIssues(found)
    setSkipped(new Set())
    setAutoFixed(undefined)
    if (found.length) setOpen(true)
    return found
  }
  const close = () => {
    setOpen(false)
    printRef.current?.focus()
  }
  const show = (issue: PrintIssue) => {
    const hidden = !issue.first.checkVisibility()
    const element = hidden ? (document.querySelector<HTMLElement>(`[aria-controls="${issue.first.id}"]`) ?? issue.first) : issue.first
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" })
    if (!still)
      element.animate([{ outline: "3px solid rgb(245 158 11)", outlineOffset: "2px" }, { outline: "3px solid rgb(245 158 11 / 0)", outlineOffset: "6px" }], {
        duration: 400,
        delay: 250,
        iterations: 2,
        easing: "ease-out",
      })
  }
  React.useEffect(() => {
    if (!checkOnMount) return
    const found = scan()
    setIssues(found)
    setOpen(found.length > 0)
  }, [checkOnMount, scan])

  const chosen = issues.filter((issue) => !skipped.has(issue.kind))

  return (
    <div data-slot="print-guard" className={cn("w-full", className)} {...props}>
      <style>{printFixCss}</style>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          ref={printRef}
          type="button"
          aria-expanded={open}
          onClick={() => {
            focusPanel.current = true
            if (review().length === 0) print([])
          }}
          className={cn(button, "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50")}
        >
          <Printer aria-hidden className="size-4" />
          {printLabel}
        </button>
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          {autoFixed !== undefined && (
            <>
              {autoFixedText.replace("{count}", plural(autoFixed, "thing", "things"))}
              <button type="button" onClick={review} className={fixClass}>
                {reviewLabel}
              </button>
            </>
          )}
        </p>
      </div>

      <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div
            ref={panelRef}
            tabIndex={-1}
            role="region"
            aria-labelledby={titleId}
            onKeyDown={(event) => event.key === "Escape" && close()}
            className="mt-2 rounded-lg border border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-sm text-amber-950 outline-none dark:text-amber-50"
          >
            <p id={titleId} className="flex items-center gap-2 px-3 pt-2.5 font-medium">
              <TriangleAlert aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {title}
            </p>
            <ul className="grid gap-2 px-3 py-2.5">
              {issues.map((issue) => {
                const Icon = icons[issue.kind]
                const text = describeIssue(issue)
                const checked = !skipped.has(issue.kind)
                return (
                  <li key={issue.kind} className="flex items-start gap-2">
                    <input
                      id={`${titleId}-${issue.kind}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSkipped((previous) => new Set(checked ? [...previous, issue.kind] : [...previous].filter((kind) => kind !== issue.kind)))}
                      className="mt-0.5 size-4 shrink-0 accent-amber-700 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:accent-amber-400"
                    />
                    <label htmlFor={`${titleId}-${issue.kind}`} className="min-w-0 flex-1">
                      <span className="flex items-start gap-1.5">
                        <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        {text.problem}
                      </span>
                      <span className={cn("block pl-5 text-xs text-amber-900/75 dark:text-amber-100/75", !checked && "line-through")}>{text.fix}</span>
                    </label>
                    <button type="button" onClick={() => show(issue)} className={fixClass}>
                      {showLabel}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap justify-end gap-2 border-t border-amber-500/20 px-3 py-2">
              <button type="button" onClick={close} className={cn(small, "hover:bg-amber-500/15")}>
                {cancelLabel}
              </button>
              <button type="button" onClick={() => print([])} className={cn(small, "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25")}>
                {printAsIsLabel}
              </button>
              <button
                type="button"
                onClick={() => print(chosen)}
                disabled={chosen.length === 0}
                className={cn(small, "bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300")}
              >
                <Printer aria-hidden className="size-4" />
                {printFixedLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
