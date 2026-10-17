"use client"

// Bollard UI — hashtag-input · MIT licence · https://bollard-ui.vercel.app/components/hashtag-input

import * as React from "react"
import { Hash, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { HASHTAG_WORDS, segmentWords } from "./hashtag-words"

export interface HashtagPlatform {
  /** Shown in the count row, e.g. "Instagram". */
  name: string
  /** Most tags the platform takes (hard) or recommends. */
  max: number
  /** True when extra tags are dropped or the post is blocked, not just discouraged. */
  hard?: boolean
}

/** Instagram caps posts and Reels at 5 since Dec 2025; LinkedIn and X only recommend a few. */
export const DEFAULT_PLATFORMS: HashtagPlatform[] = [
  { name: "Instagram", max: 5, hard: true },
  { name: "LinkedIn", max: 5 },
  { name: "X", max: 2 },
]

export type HashtagIssue =
  | { kind: "breaks"; tag: string; at: string; posts: string; fix: string }
  | { kind: "numeric"; tag: string }
  | { kind: "duplicate"; tag: string; of: string }
  | { kind: "banned"; tag: string }
  | { kind: "camel"; tag: string; fix: string }

const pascal = (parts: string[]) => parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")

/**
 * One issue per tag, most serious first: characters that end the tag early
 * (#don't posts as #don), all-digit tags that never link, case-only duplicates,
 * banned tags, and all-lowercase multi-word tags that screen readers slur together.
 */
export function findHashtagIssues(tags: string[], { banned = [], words = [] }: { banned?: string[]; words?: string[] } = {}) {
  const dictionary = new Set([...HASHTAG_WORDS, ...words.map((w) => w.toLowerCase())])
  const bannedSet = new Set(banned.map((b) => b.replace(/^#/, "").toLowerCase()))
  const seen = new Map<string, string>()
  const issues: HashtagIssue[] = []
  for (const tag of tags) {
    const key = tag.toLowerCase()
    const breakAt = tag.search(/[^\p{L}\p{N}_]/u)
    if (breakAt >= 0) {
      const words = tag.replace(/['’]/g, "").split(/[^\p{L}\p{N}_]+/u).filter(Boolean)
      const fix = words.every((w) => w === w.toLowerCase()) ? pascal(words) : words.join("")
      const at = /\s/.test(tag[breakAt]) ? "the space" : `“${tag[breakAt]}”`
      issues.push({ kind: "breaks", tag, at, posts: tag.slice(0, breakAt), fix })
    } else if (/^[\d_]+$/.test(tag)) issues.push({ kind: "numeric", tag })
    else if (seen.has(key)) issues.push({ kind: "duplicate", tag, of: seen.get(key)! })
    else if (bannedSet.has(key)) issues.push({ kind: "banned", tag })
    else if (tag === key) {
      const parts = segmentWords(key, dictionary)
      if (parts && parts.length > 1) issues.push({ kind: "camel", tag, fix: pascal(parts) })
    }
    if (!seen.has(key)) seen.set(key, tag)
  }
  return issues
}

export interface HashtagInputProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled tags, without the #. */
  value?: string[]
  /** Initial tags when uncontrolled. */
  defaultValue?: string[]
  /** Called with the current list of tags. */
  onValueChange?: (tags: string[]) => void
  /** Per-platform limits shown as counts. */
  platforms?: HashtagPlatform[]
  /** Tags that are banned or read as spam on your platforms (case-insensitive). */
  banned?: string[]
  /** Extra words (brand names, jargon) used to suggest CamelCase. */
  words?: string[]
  /** Input placeholder. */
  placeholder?: string
  /** Messages; `{tag}`, `{at}`, `{posts}`, `{of}` and `{fix}` are filled in. */
  messages?: Partial<Record<HashtagIssue["kind"], string>>
  /** `{name}`, `{count}` ("1 tag") and `{tags}` are filled in. */
  overLimitText?: string
  /** Accessible label for each tag's remove button; {tag} is filled in. */
  removeLabel?: string
}

const MESSAGES: Record<HashtagIssue["kind"], string> = {
  breaks: "#{tag} stops at {at} and posts as #{posts}.",
  numeric: "#{tag} won't link. Tags need at least one letter.",
  duplicate: "#{tag} is the same tag as #{of}.",
  banned: "#{tag} is flagged as spammy and can hide your post.",
  camel: "Screen readers read #{tag} as one word.",
}
const FIX: Record<HashtagIssue["kind"], string> = { breaks: "Use #{fix}", camel: "Use #{fix}", duplicate: "Remove", banned: "Remove", numeric: "Remove" }

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A hashtag field that catches the tags that quietly fail: a space or apostrophe that
 * cuts the tag short, case-only duplicates, all-digit tags, banned tags and posts over
 * a platform's limit. It suggests CamelCase (#OpenSource) so screen readers say the words,
 * and flashes the original chip when you add a duplicate. Fixes are one tap, never automatic.
 */
export function HashtagInput({
  label = "Hashtags",
  value,
  defaultValue = [],
  onValueChange,
  platforms = DEFAULT_PLATFORMS,
  banned,
  words,
  placeholder = "Add a tag, then Enter",
  messages,
  overLimitText = "{name} keeps {max}: {tags} would be dropped.",
  removeLabel = "Remove #{tag}",
  className,
  ...props
}: HashtagInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [draft, setDraft] = React.useState("")
  const tags = value ?? inner
  const inputId = React.useId()
  const chips = React.useRef(new Map<number, HTMLElement>())

  const update = (next: string[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const flash = (index: number) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    chips.current.get(index)?.animate([{ transform: "scale(1.12)", backgroundColor: "rgb(245 158 11 / 0.35)" }, {}], { duration: 350, easing: "ease-out" })
  }

  const commit = (text = draft) => {
    const pieces = text.split(/[#,\n]+/).map((p) => p.trim()).filter(Boolean)
    if (!pieces.length) return
    const existing = tags.findIndex((t) => t.toLowerCase() === pieces[0].toLowerCase())
    if (existing >= 0) flash(existing)
    update([...tags, ...pieces])
    setDraft("")
  }

  const issues = findHashtagIssues(tags, { banned, words })
  const flagged = new Set(issues.map((i) => i.tag))
  const text = { ...MESSAGES, ...messages }
  const hardOver = platforms.find((p) => p.hard && tags.length > p.max)

  const fix = (issue: HashtagIssue) => {
    const index = tags.lastIndexOf(issue.tag)
    if (issue.kind === "breaks" || issue.kind === "camel") update(tags.map((t, i) => (i === index ? issue.fix : t)))
    else update(tags.filter((_, i) => i !== index))
  }

  return (
    <div data-slot="hashtag-input" className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-1.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            ref={(el) => { if (el) chips.current.set(i, el); else chips.current.delete(i) }}
            className={cn(
              "inline-flex h-6 items-center gap-0.5 rounded-md bg-muted pr-0.5 pl-2 text-xs font-medium",
              flagged.has(tag) && "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-200",
            )}
          >
            #{tag}
            <button type="button" aria-label={fill(removeLabel, { tag })} onClick={() => update(tags.filter((_, j) => j !== i))} className="grid size-5 place-items-center rounded-sm opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <span className="flex min-w-28 flex-1 items-center gap-1 px-1.5">
          <Hash aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            id={inputId}
            value={draft}
            placeholder={placeholder}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text")
              if (!/[,\n]|\s#/.test(pasted)) return
              e.preventDefault()
              commit(draft + pasted)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit() }
              if (e.key === "Backspace" && !draft && tags.length) update(tags.slice(0, -1))
            }}
            onBlur={() => commit()}
            className="h-6 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </span>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Tag count per platform">
        {platforms.map((p) => {
          const over = tags.length > p.max
          return (
            <span key={p.name} className={cn("tabular-nums", over && (p.hard ? "font-medium text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"))}>
              {p.name} {tags.length}/{p.max}
            </span>
          )
        })}
      </p>
      <div aria-live="polite" className="grid gap-1 text-xs">
        {hardOver && (
          <p className="flex gap-1.5 text-red-600 dark:text-red-400">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {fill(overLimitText, { name: hardOver.name, max: String(hardOver.max), tags: tags.slice(hardOver.max).map((t) => `#${t}`).join(" ") })}
          </p>
        )}
        {issues.slice(0, 3).map((issue) => (
          <p key={`${issue.kind}-${issue.tag}`} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(text[issue.kind], issue as Record<string, string>)}</span>
              <button type="button" onClick={() => fix(issue)} className={fixClass}>{fill(FIX[issue.kind], issue as Record<string, string>)}</button>
            </span>
          </p>
        ))}
        {issues.length > 3 && <p className="pl-5 text-muted-foreground">+{issues.length - 3} more</p>}
      </div>
    </div>
  )
}
