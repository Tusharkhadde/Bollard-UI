"use client"

import * as React from "react"
import { ArrowRight, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  BUMP_RANK,
  bumpVersion,
  caretAccepts,
  classifyChange,
  compareVersions,
  formatVersion,
  parseVersion,
  requiredBump,
  stepRank,
  type Bump,
  type Change,
  type ChangeKind,
} from "./semver"

export * from "./semver"

/** Every user-visible string. Functions receive the values they mention. */
export const VERSION_BUMP_MESSAGES = {
  bumps: { major: "Major", minor: "Minor", patch: "Patch", prerelease: "Pre" } as Record<Bump, string>,
  kinds: { breaking: "Breaking", feature: "Feature", fix: "Fix", other: "Other" } as Record<ChangeKind, string>,
  label: "Next version",
  needed: "Needed",
  tag: "Pre-release tag",
  invalid: (current: string) => `"${current}" isn't a semantic version (like 1.4.2).`,
  under: (count: number, kind: string, bump: string, current: string) =>
    `${count} ${kind.toLowerCase()} ${count === 1 ? "change" : "changes"} would ship as a ${bump.toLowerCase()}: anyone on ^${current} gets ${count === 1 ? "it" : "them"} on their next install.`,
  over: (current: string) => `Nothing here is breaking. A major makes everyone on ^${current} upgrade by hand.`,
  backwards: (next: string, current: string) => `${next} sorts before ${current}, so package managers see it as older.`,
  zero: (current: string) => `In 0.x the minor is the breaking slot (^${current} stops before the next minor). Ready for 1.0.0?`,
  fixTo: (bump: string) => `Bump ${bump.toLowerCase()}`,
  keepTag: (tag: string) => `Stay on ${tag}`,
  graduate: "Release 1.0.0",
  caretYes: (current: string) => `Installs automatically for anyone on ^${current}.`,
  caretNo: (current: string) => `Anyone on ^${current} upgrades by hand.`,
  caretPre: "Pre-releases only install when someone asks for that tag or version.",
}

export interface VersionBumpProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The version being released from. */
  current: string
  /** Changes since `current`: Conventional Commits subjects ("feat!: drop Node 16") or classified entries. */
  changes: (string | Change)[]
  /** Controlled bump. */
  value?: Bump
  /** Initial bump when uncontrolled. Defaults to the smallest one the changes need. */
  defaultValue?: Bump
  /** Called when the bump changes. */
  onValueChange?: (bump: Bump) => void
  /** Called with the resulting version string whenever it changes. */
  onVersionChange?: (version: string) => void
  /** Pre-release tag to use. Defaults to the current one, or "beta". */
  defaultPreid?: string
  /** Override any string. */
  messages?: Partial<typeof VERSION_BUMP_MESSAGES>
}

const BUMPS: Bump[] = ["major", "minor", "patch", "prerelease"]
const kindTone: Record<ChangeKind, string> = {
  breaking: "bg-red-500/10 text-red-700 dark:text-red-400",
  feature: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  fix: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  other: "bg-muted text-muted-foreground",
}
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = "@keyframes cui-version-bump-in{from{opacity:0;transform:translateY(-40%)}to{opacity:1;transform:none}}"

/** "2.0.0" with the parts that differ from "1.4.2" marked. */
function Readback({ from, to }: { from: string; to: string }) {
  const a = from.split(/([.-])/)
  return (
    <span key={to} className="inline-block motion-safe:animate-[cui-version-bump-in_250ms_ease-out]">
      {to.split(/([.-])/).map((part, i, parts) => {
        const changed = parts.slice(0, i + 1).join("") !== a.slice(0, i + 1).join("")
        return (
          <span key={i} className={cn(changed && /\w/.test(part) && "text-primary underline decoration-2 underline-offset-4")}>
            {part}
          </span>
        )
      })}
    </span>
  )
}

/**
 * Picks the next semantic version from the changes since the last one, so a breaking change can't slip
 * out as a minor or patch that every ^range installs automatically. It knows 0.x moves the breaking slot
 * to the minor, that bumping a pre-release can just drop its tag, and that a new tag can sort before the
 * old one (2.0.0-beta.0 < 2.0.0-rc.1). Each option previews its version and the result reads back as
 * "1.4.2 → 2.0.0" with what anyone on ^1.4.2 will get.
 */
export function VersionBump({
  current,
  changes,
  value,
  defaultValue,
  onValueChange,
  onVersionChange,
  defaultPreid,
  messages,
  className,
  ...props
}: VersionBumpProps) {
  const m = { ...VERSION_BUMP_MESSAGES, ...messages }
  const cur = parseVersion(current)
  const list = changes.map((c) => (typeof c === "string" ? { title: c, kind: classifyChange(c) } : c))
  const needed = cur ? requiredBump(cur, list) : null
  const [inner, setInner] = React.useState<Bump>(defaultValue ?? needed ?? "patch")
  const bump = value ?? inner
  const [preid, setPreid] = React.useState(defaultPreid ?? cur?.pre[0] ?? "beta")
  const radios = React.useRef<(HTMLButtonElement | null)[]>([])
  const groupId = React.useId()

  const nextOf = (b: Bump) => (cur ? bumpVersion(cur, b, preid.trim(), needed ?? "patch") : null)
  const next = nextOf(bump)
  const nextText = next ? formatVersion(next) : ""

  React.useEffect(() => {
    if (nextText) onVersionChange?.(nextText)
  }, [nextText, onVersionChange])

  const choose = (b: Bump) => {
    if (value === undefined) setInner(b)
    onValueChange?.(b)
  }

  if (!cur || !next) {
    return (
      <div role="alert" data-slot="version-bump" className={cn("text-sm text-destructive", className)} {...props}>
        {m.invalid(current)}
      </div>
    )
  }

  const rank = stepRank(cur, next)
  const neededRank = needed ? BUMP_RANK[needed] : 0
  const neededKind: ChangeKind = list.some((c) => c.kind === "breaking") ? "breaking" : list.some((c) => c.kind === "feature") ? "feature" : "fix"
  const curText = formatVersion(cur)
  let warning: { text: string; fix?: () => void; fixText?: string } | null = null
  if (needed && rank < neededRank) {
    warning = {
      text: m.under(list.filter((c) => c.kind === neededKind).length, m.kinds[neededKind], m.bumps[bump], curText),
      fix: () => choose(needed),
      fixText: m.fixTo(m.bumps[needed]),
    }
  } else if (compareVersions(next, cur) <= 0) {
    warning = { text: m.backwards(nextText, curText), fix: () => setPreid(cur.pre[0] ?? "beta"), fixText: m.keepTag(cur.pre[0] ?? "beta") }
  } else if (!next.pre.length && rank === BUMP_RANK.major && neededRank < BUMP_RANK.major && cur.major > 0) {
    warning = { text: m.over(curText), fix: needed ? () => choose(needed) : undefined, fixText: needed ? m.fixTo(m.bumps[needed]) : undefined }
  }

  const onKeyDown = (event: React.KeyboardEvent, i: number) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!delta) return
    event.preventDefault()
    const j = (i + delta + BUMPS.length) % BUMPS.length
    choose(BUMPS[j])
    radios.current[j]?.focus()
  }

  return (
    <div data-slot="version-bump" className={cn("grid w-full max-w-sm gap-3", className)} {...props}>
      <style>{keyframes}</style>
      <div className="grid gap-1">
        <span id={`${groupId}-label`} className="text-sm font-medium">
          {m.label}
        </span>
        <p aria-live="polite" className="flex items-center gap-2 font-mono text-2xl font-semibold tabular-nums">
          <span className="text-muted-foreground">{curText}</span>
          <ArrowRight aria-label="to" className="size-5 shrink-0 text-muted-foreground" />
          <Readback from={curText} to={nextText} />
        </p>
      </div>

      <div role="radiogroup" aria-labelledby={`${groupId}-label`} className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {BUMPS.map((b, i) => {
          const selected = b === bump
          return (
            <button
              key={b}
              ref={(el) => {
                radios.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(b)}
              onKeyDown={(event) => onKeyDown(event, i)}
              className={cn(
                "relative grid gap-0.5 rounded-md px-1 py-1.5 text-center text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected ? "bg-background text-foreground shadow-xs dark:bg-input/50" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {b === needed && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" title={m.needed}>
                  <span className="sr-only">{m.needed}</span>
                </span>
              )}
              <span>{m.bumps[b]}</span>
              <span title={formatVersion(nextOf(b)!)} className="truncate font-mono text-[11px] font-normal">
                {formatVersion(nextOf(b)!)}
              </span>
            </button>
          )
        })}
      </div>

      {bump === "prerelease" && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {m.tag}
          <input
            value={preid}
            onChange={(event) => setPreid(event.target.value.replace(/[^0-9a-z-]/gi, ""))}
            spellCheck={false}
            className="h-8 w-24 min-w-0 rounded-md border bg-transparent px-2 font-mono text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </label>
      )}

      <ul className="grid gap-1 text-sm">
        {list.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2">
            <span className={cn("w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium", kindTone[c.kind])}>{m.kinds[c.kind]}</span>
            <span className="truncate">{c.title}</span>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="grid gap-1.5 text-xs">
        {warning ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{warning.text}</span>
              {warning.fix && (
                <button type="button" onClick={warning.fix} className={fixClass}>
                  {warning.fixText}
                </button>
              )}
            </span>
          </p>
        ) : cur.major === 0 && needed === "minor" && bump === "minor" ? (
          <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
            <span className="py-1">{m.zero(curText)}</span>
            <button type="button" onClick={() => choose("major")} className="inline-flex h-6 items-center rounded-md border px-2 font-medium transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {m.graduate}
            </button>
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {next.pre.length ? m.caretPre : caretAccepts(cur, next) ? m.caretYes(curText) : m.caretNo(curText)}
        </p>
      </div>
    </div>
  )
}
