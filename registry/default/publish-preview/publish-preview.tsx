"use client"

// Bollard UI — publish-preview · MIT licence · https://bollard-ui.vercel.app/components/publish-preview

import * as React from "react"
import { CircleAlert, CircleCheck, Info, Loader2, Package, RefreshCw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { exclusionSnippet, formatBytes, parsePackJsonAll, reviewPack, type PackageJson, type PackIssue, type PackIssueKind, type PackReviewOptions, type PackResult } from "./pack-review"

export { entryPoints, exclusionSnippet, formatBytes, nextFreeVersion, parsePackJson, parsePackJsonAll, parseSemver, reviewPack, type PackageJson, type PackFile, type PackIssue, type PackIssueKind, type PackResult, type PackReviewOptions } from "./pack-review"

export type PublishFix = { kind: "version"; to: string } | { kind: "files"; files: string[] } | { kind: "exclude"; patterns: string[]; where: "files" | ".npmignore" }

/** Every visible string. `{count}`, `{files}`, `{paths}`, `{version}`, `{next}`, `{dirs}`, `{size}`, `{packed}`, `{unpacked}`, `{name}` are filled in. */
export const PUBLISH_PREVIEW_MESSAGES = {
  title: "npm publish",
  sizes: "{files} files · {packed} packed · {unpacked} unpacked",
  blocked: "{count} to fix before this can be published.",
  warnings: "Ready, with {count} to check.",
  ready: "Ready to publish. The file list below is exactly what goes to the registry.",
  unreadable: "Couldn't read this as npm pack --dry-run --json output.",
  workspaces: "This output has {count} packages ({names}). Showing {name}; pass packageName to check another.",
  private: "\"private\": true is set, so npm will refuse to publish. Remove it only if this package is meant to be public.",
  published: "{version} is already on npm. A version can never be reused, not even after unpublishing.",
  "missing-entry": "Missing from the tarball: {paths}. Installs would fail to import it.",
  "missing-gitignore": "Your .gitignore drops {dirs}/, and with no .npmignore or files list npm uses .gitignore.",
  "missing-files": "Your files list doesn't include {dirs}.",
  "missing-built": "Run the build, then pack again.",
  "missing-script": "Add \"prepublishOnly\": \"npm run build\" so it can't be forgotten.",
  sensitive: "{paths} would be public on npm for anyone to download. Treat any secret in it as leaked once published.",
  "source-map": "Source maps ({count}) can carry your full original source (sourcesContent).",
  tests: "Test files ({count}) that nobody who installs this needs.",
  "dev-files": "Repo config files ({count}) that only matter to you.",
  "big-file": "{paths} is {size}. Every install downloads it.",
  "no-allowlist": "No files list or .npmignore, so everything not in .gitignore ships, including anything you add later.",
  useVersion: "Use {next}",
  addFiles: "Add files list",
  exclude: "Exclude",
  snippetFiles: "In package.json \"files\": {text}",
  snippetIgnore: "In .npmignore: {text}",
  newIgnore: "Creating .npmignore makes npm stop reading .gitignore, so copy those lines in too.",
  waiting: "Changed. Run npm pack --dry-run again to confirm.",
  listHeading: "Tarball contents",
  showMore: "Show {hidden} more",
  publish: "Publish {name}@{version}",
  publishing: "Publishing…",
}
export type PublishPreviewMessages = typeof PUBLISH_PREVIEW_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const fixButton = "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tag: Partial<Record<PackIssueKind, string>> = { sensitive: "secret?", "source-map": "map", tests: "test", "dev-files": "dev", "big-file": "large" }
const severityTone = { blocker: "text-red-700 dark:text-red-400", warning: "text-amber-800 dark:text-amber-300", info: "text-muted-foreground" }
const severityIcon = { blocker: CircleAlert, warning: TriangleAlert, info: Info }

/** Announces `text` only once it stops changing, so a re-pack doesn't produce a burst of announcements. */
function useSettled(text: string, delay = 700) {
  const [settled, setSettled] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface PublishPreviewProps extends PackReviewOptions, Omit<React.ComponentProps<"div">, "onChange"> {
  /** Output of `npm pack --dry-run --json` (string or parsed). */
  pack: string | PackResult | unknown
  /** The package.json (object or text) of the package being checked. */
  pkg?: PackageJson | string
  /** With `--workspaces` output, which package to check. Defaults to the one named in `pkg`, else the first. */
  packageName?: string
  /** Called with a change to make; the issue then waits for a fresh `pack` to confirm it. */
  onFix?: (fix: PublishFix, issue: PackIssue) => void
  /** Shows the publish button, enabled when nothing blocks. May return a Promise for a pending state. */
  onPublish?: () => void | Promise<void>
  /** Files listed before "Show more"; flagged files always come first. */
  maxFiles?: number
  /** Locale for sizes. */
  locale?: string
  /** Any visible string. */
  messages?: Partial<PublishPreviewMessages>
}

/**
 * Prevents publishing the wrong thing to npm, where a version can never be taken back. It previews the tarball from
 * `npm pack --dry-run --json` and flags .env files and keys, source maps, tests, repo config, large files, entry points
 * missing from the build (and why: .gitignore fallback, files list, or no build), a version already published, `private`,
 * and the lack of a files allowlist, with one-tap fixes that wait for a fresh pack before they count.
 */
export function PublishPreview({ pack, pkg, packageName, published, hasNpmignore, gitignore, bigFileBytes, onFix, onPublish, maxFiles = 8, locale, messages, className, ...props }: PublishPreviewProps) {
  const t = { ...PUBLISH_PREVIEW_MESSAGES, ...messages }
  const pkgObj = React.useMemo<PackageJson>(() => {
    try {
      return (typeof pkg === "string" ? JSON.parse(pkg.replace(/^\uFEFF/, "")) : pkg) ?? {}
    } catch {
      return {}
    }
  }, [pkg])
  const all = React.useMemo(() => parsePackJsonAll(pack), [pack])
  const want = packageName ?? pkgObj.name
  const result = React.useMemo(() => all.find((p) => p.name === want) ?? all[0] ?? null, [all, want])
  const issues = React.useMemo(() => reviewPack(result, pkgObj, { published, hasNpmignore, gitignore, bigFileBytes }), [result, pkgObj, published, hasNpmignore, gitignore, bigFileBytes])
  const [waiting, setWaiting] = React.useState<PackIssueKind[]>([])
  const [expanded, setExpanded] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const busy = React.useRef(false)
  const list = React.useRef<HTMLUListElement>(null)
  const publishRef = React.useRef<HTMLButtonElement>(null)
  const refocus = React.useRef<PackIssueKind | "" | null>(null)
  const id = React.useId()

  // A new pack is the confirmation: clear every "waiting".
  React.useEffect(() => setWaiting([]), [result])
  React.useEffect(() => {
    if (refocus.current === null) return
    const target = list.current?.querySelector<HTMLButtonElement>(`li[data-kind="${refocus.current}"] button[data-fix]`)
    ;(target ?? (publishRef.current && !publishRef.current.disabled ? publishRef.current : list.current))?.focus()
    refocus.current = null
  }, [waiting])

  const blockers = issues.filter((i) => i.severity === "blocker")
  const warnings = issues.filter((i) => i.severity === "warning")
  const name = result?.name || pkgObj.name || "package"
  const version = result?.version || pkgObj.version || "?"
  const flagged = new Map<string, PackIssueKind>()
  issues.forEach((i) => i.paths.forEach((p) => tag[i.kind] && !flagged.has(p) && flagged.set(p, i.kind)))
  const files = result ? [...result.files].sort((a, b) => Number(flagged.has(b.path)) - Number(flagged.has(a.path)) || a.path.localeCompare(b.path)) : []
  const shown = expanded || files.length <= maxFiles + 1 ? files : files.slice(0, maxFiles)
  const list3 = (paths: string[]) => paths.slice(0, 3).join(", ") + (paths.length > 3 ? ` +${paths.length - 3}` : "")

  const apply = (issue: PackIssue, fix: PublishFix) => {
    const open = issues.filter((i) => i !== issue && !waiting.includes(i.kind) && fixFor(i))
    refocus.current = open.find((i) => issues.indexOf(i) > issues.indexOf(issue))?.kind ?? open[0]?.kind ?? ""
    setWaiting((w) => [...w, issue.kind])
    onFix?.(fix, issue)
  }
  const fixFor = (issue: PackIssue): PublishFix | null => {
    if (issue.kind === "published" && issue.nextVersion) return { kind: "version", to: issue.nextVersion }
    if ((issue.kind === "missing-entry" && issue.cause !== "not-built") || issue.kind === "no-allowlist") return issue.patterns?.length ? { kind: "files", files: issue.patterns } : null
    if (tag[issue.kind] && issue.patterns?.length) return { kind: "exclude", patterns: issue.patterns, where: exclusionSnippet(issue.patterns, pkgObj).where }
    return null
  }
  const label = (fix: PublishFix) => (fix.kind === "version" ? fill(t.useVersion, { next: fix.to }) : fix.kind === "files" ? t.addFiles : t.exclude)
  const describe = (issue: PackIssue) => {
    const values = { paths: list3(issue.paths), count: issue.paths.length, version, dirs: (issue.gitignored ?? issue.patterns ?? []).join("/, "), size: formatBytes(result?.files.find((f) => f.path === issue.paths[0])?.size ?? 0, locale) }
    if (issue.kind !== "missing-entry") return fill(t[issue.kind], values)
    const why = issue.cause === "gitignore" ? t["missing-gitignore"] : issue.cause === "files" ? t["missing-files"] : `${t["missing-built"]}${pkgObj.scripts?.prepublishOnly || pkgObj.scripts?.prepack || pkgObj.scripts?.prepare ? "" : " " + t["missing-script"]}`
    return `${fill(t["missing-entry"], values)} ${fill(why, { ...values, dirs: issue.cause === "gitignore" ? (issue.gitignored ?? []).join("/, ") : (issue.patterns ?? []).join(", ") })}`
  }
  const publish = async () => {
    if (!onPublish || blockers.length || busy.current) return
    busy.current = true
    setPending(true)
    try {
      await onPublish()
    } catch {
      // The caller reports registry errors; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const summary = !result ? t.unreadable : blockers.length ? fill(t.blocked, { count: blockers.length }) : warnings.length ? fill(t.warnings, { count: warnings.length }) : t.ready
  const announced = useSettled(summary)
  const tone = !result || blockers.length ? "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300" : warnings.length ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
  const SummaryIcon = !result || blockers.length ? CircleAlert : warnings.length ? TriangleAlert : CircleCheck

  return (
    <div data-slot="publish-preview" data-state={blockers.length ? "blocked" : "ready"} className={cn("w-full max-w-lg min-w-0 overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      <div className="grid gap-0.5 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Package aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="min-w-0 flex-1 font-medium"><span className="text-muted-foreground">{t.title} </span><span className="font-mono [overflow-wrap:anywhere]">{name}@{version}</span></h3>
        </div>
        {result && <p className="pl-6 text-xs text-muted-foreground tabular-nums">{fill(t.sizes, { files: result.files.length, packed: formatBytes(result.size, locale), unpacked: formatBytes(result.unpackedSize, locale) })}</p>}
        {all.length > 1 && result && <p className="pl-6 text-xs text-muted-foreground [overflow-wrap:anywhere]">{fill(t.workspaces, { count: all.length, names: all.map((p) => p.name).join(", "), name: result.name })}</p>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3">
        <p id={`${id}-summary`} className={cn("flex gap-2 rounded-md border p-3 font-medium", tone)}>
          <SummaryIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{summary}</span>
        </p>

        {issues.length > 0 && (
          <ul ref={list} tabIndex={-1} className="grid gap-2 outline-none">
            {issues.map((issue) => {
              const Icon = severityIcon[issue.severity]
              const fix = fixFor(issue)
              const snippet = fix?.kind === "exclude" ? exclusionSnippet(fix.patterns, pkgObj) : null
              const isWaiting = waiting.includes(issue.kind)
              return (
                <li key={issue.kind} data-kind={issue.kind} className={cn("flex gap-1.5 text-xs", severityTone[issue.severity])}>
                  <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <span className="[overflow-wrap:anywhere]">{describe(issue)}</span>
                    {isWaiting ? (
                      <span className="flex items-start gap-1.5 text-muted-foreground"><RefreshCw aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t.waiting}</span>
                    ) : fix && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button type="button" data-fix="" onClick={() => apply(issue, fix)} className={cn(fixButton, issue.severity === "blocker" ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
                          {label(fix)}
                        </button>
                        <code className="min-w-0 font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                          {fix.kind === "files" ? `"files": [${fix.files.map((f) => `"${f}"`).join(", ")}]` : snippet ? fill(snippet.where === "files" ? t.snippetFiles : t.snippetIgnore, { text: snippet.text.replace(/\n/g, ", ") }) : null}
                        </code>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!hasNpmignore && issues.some((i) => !waiting.includes(i.kind) && fixFor(i)?.kind === "exclude" && exclusionSnippet(i.patterns ?? [], pkgObj).where === ".npmignore") && (
          <p className="-mt-1 flex gap-1.5 text-xs text-muted-foreground"><Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />{t.newIgnore}</p>
        )}

        {result && files.length > 0 && (
          <section aria-labelledby={`${id}-files`} className="overflow-hidden rounded-md border">
            <h4 id={`${id}-files`} className="border-b bg-muted/50 px-2.5 py-1.5 text-xs font-medium">{t.listHeading}</h4>
            <ul className="divide-y text-xs">
              {shown.map((f) => {
                const kind = flagged.get(f.path)
                const blocker = kind && issues.find((i) => i.kind === kind)?.severity === "blocker"
                return (
                  <li key={f.path} data-flag={kind} className={cn("flex min-w-0 items-baseline gap-2 px-2.5 py-1", kind && (blocker ? "bg-red-500/5" : "bg-amber-500/5"))}>
                    <span className="min-w-0 flex-1 font-mono [overflow-wrap:anywhere]">{f.path}</span>
                    {kind && <span className={cn("shrink-0 rounded border px-1 text-[11px] font-medium", blocker ? "border-red-500/40 text-red-700 dark:text-red-300" : "border-amber-500/40 text-amber-800 dark:text-amber-300")}>{tag[kind]}</span>}
                    <span className="shrink-0 font-mono text-muted-foreground tabular-nums">{formatBytes(f.size, locale)}</span>
                  </li>
                )
              })}
            </ul>
            {shown.length < files.length && (
              <button type="button" onClick={() => setExpanded(true)} className="w-full border-t px-2.5 py-1.5 text-left text-xs font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
                {fill(t.showMore, { hidden: files.length - shown.length })}
              </button>
            )}
          </section>
        )}
      </div>

      <span role="status" className="sr-only">{announced}</span>
      {onPublish && (
        <div className="flex justify-end border-t px-4 py-3">
          <button ref={publishRef} type="button" onClick={publish} disabled={!result || blockers.length > 0 || pending} aria-busy={pending || undefined} aria-describedby={`${id}-summary`} className="inline-flex h-9 max-w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50">
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            <span className="min-w-0 truncate">{pending ? t.publishing : fill(t.publish, { name, version })}</span>
          </button>
        </div>
      )}
    </div>
  )
}
