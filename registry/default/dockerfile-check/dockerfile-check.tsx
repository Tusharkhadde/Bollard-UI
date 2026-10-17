"use client"

// Bollard UI — dockerfile-check · MIT licence · https://bollard-ui.vercel.app/components/dockerfile-check

import * as React from "react"
import { CircleAlert, CircleCheck, Copy, Info, Layers, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkDockerfile, finalImageSummary, STARTER_DOCKERIGNORE, type DockerIssue } from "@/registry/default/dockerfile-check/dockerfile"

export { checkDockerfile, finalImageSummary, isSecretKey, parseDockerfile, stageChain, STARTER_DOCKERIGNORE, type DockerContext, type DockerIssue, type DockerIssueKind, type Instruction, type Stage } from "@/registry/default/dockerfile-check/dockerfile"

export const DOCKERFILE_CHECK_MESSAGES = {
  label: "Dockerfile",
  placeholder: "FROM node:20-slim\nWORKDIR /app",
  clean: "No problems found.",
  problems: "{errors} to fix · {warnings} to review",
  line: "Line {line}",
  selectLine: "Select line {line}",
  fixAll: "Fix {count}",
  fix: "Fix",
  summary: "Final image: {image} · {stages} · {user}",
  oneStage: "1 stage",
  manyStages: "{count} stages",
  runsAsRoot: "runs as root",
  runsAsAdmin: "runs as ContainerAdministrator",
  runsAs: "runs as {user}",
  "root-user": "The final image never switches to a non-root USER, so the app runs as root and a break-in gets root in the container.",
  "root-user-drops": "No USER, so {image} starts as root. Its entrypoint drops to its own user for the real work, so this is the image's normal setup; for a fully non-root start use its unprivileged variant or docker run --user.",
  "root-user-windows": "No non-admin USER, so the app runs as ContainerAdministrator. If it doesn't need admin rights, run it as ContainerUser.",
  "fix-root-user": "Run as {detail}",
  "unpinned-base": "{detail} has no version tag, so it means :latest and changes under you. Pin a tag or digest (ImageTagInput checks the reference in depth).",
  "secret-arg": "{key} is a build arg, and build args show up in docker history and provenance. Pass it as a secret mount: {command}",
  "secret-env": "{key} is set with ENV, so it's saved in the image for anyone who pulls it. Rotate it if it was ever pushed, then pass it as a secret: {command}",
  "secret-env-runtime": "{key} is set with ENV, so it's saved in the image for anyone who pulls it. Rotate it if it was ever pushed, delete this line, and pass it when the container starts: {command} or your platform's secrets.",
  "fix-secret": "Use a secret mount",
  "secret-file": "{file} is copied into the final image, so anyone who pulls it can read it. Mount it for the one RUN that needs it: {command}",
  "stage-leak": "{file} stays in this build stage, but COPY --from on line {copy} brings it into the final image. Mount it instead: {command}",
  "copy-before-install": "COPY . runs before the install, so any code change re-downloads every dependency. Copy {detail} first.",
  "fix-copy-before-install": "Install from the manifest first",
  dockerignore: "COPY . sends the whole folder, including .git and .env, unless .dockerignore excludes them.",
  dockerignoreMissing: "COPY . sends the whole folder, and there's no .dockerignore, so .git, .env and node_modules go too.",
  dockerignoreGaps: "COPY . sends the whole folder, and .dockerignore doesn't exclude {detail}.",
  copyStarter: "Copy a starter .dockerignore",
  copied: "Copied",
  copiedStatus: "Starter .dockerignore copied.",
  copyFailed: "Couldn't reach the clipboard.",
  apt: "apt-get install has no -y, so the build stops at the \"Do you want to continue?\" prompt and fails. Also missing: {detail}.",
  aptBloat: "apt-get install is missing {detail}, so recommended packages and the package lists stay in the image.",
  "fix-apt": "Add {detail}",
  "apt-update-alone": "apt-get update on its own line is cached, so a later install uses old package lists. Put update and install in one RUN.",
  "add-url": "ADD fetches {detail} with no checksum, so the build trusts whatever the server returns. Add --checksum=sha256:… (or a commit for Git).",
  "curl-pipe": "Piping {detail} into a shell hides a failed download: the shell only checks the last command, so the build can pass with a half-run script. Download it first, or run it with SHELL [\"/bin/bash\", \"-o\", \"pipefail\", \"-c\"] (Debian's /bin/sh has no pipefail). (CurlPipeGuard checks the script's host and checksum.)",
  "fix-curl-pipe": "Download, then run",
  "shell-form": "Shell-form CMD runs under a shell (/bin/sh -c, or cmd /S /C on Windows) that doesn't pass on the stop signal, so docker stop waits 10 s and kills the app.",
  "entrypoint-shell": "Shell-form ENTRYPOINT ignores CMD and docker run arguments, and the app never gets the stop signal.",
  "fix-shell-form": "Use exec form",
}
export type DockerfileCheckMessages = typeof DOCKERFILE_CHECK_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface DockerfileCheckProps extends Omit<React.ComponentProps<"textarea">, "value" | "defaultValue" | "onChange"> {
  /** Controlled Dockerfile text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** The project's .dockerignore: its text, `null` if there is none, or leave out when unknown. */
  dockerignore?: string | null
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{line}`, `{detail}`, `{key}`, `{file}`, `{command}` and friends are filled in. */
  messages?: Partial<DockerfileCheckMessages>
}

/**
 * A Dockerfile editor that catches the build mistakes that ship: running as root, secrets in ARG/ENV, secret files
 * baked in or carried over by COPY --from, COPY . before the install, a missing .dockerignore, apt-get without -y,
 * --no-install-recommends or list cleanup, ADD from a URL without a checksum, curl | sh, and shell-form CMD and
 * ENTRYPOINT that swallow SIGTERM. Most fix in one tap. Tag checks stay minimal: use ImageTagInput for references.
 */
export function DockerfileCheck({ value, defaultValue = "", onValueChange, dockerignore, label, messages, rows = 12, id, className, ref, "aria-describedby": describedBy, ...props }: DockerfileCheckProps) {
  const t = { ...DOCKERFILE_CHECK_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const [copied, setCopied] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const raw = value ?? inner
  const text = typeof raw === "string" ? raw : ""
  React.useImperativeHandle(ref, () => textarea.current as HTMLTextAreaElement)

  const issues = React.useMemo(() => checkDockerfile(text, { dockerignore }), [text, dockerignore])
  const image = React.useMemo(() => finalImageSummary(text), [text])
  const counted = issues.filter((issue) => issue.severity !== "info")
  const errors = counted.filter((issue) => issue.severity === "error").length
  const fixable = counted.filter((issue) => issue.fix !== undefined)
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { errors, warnings: counted.length - errors }) : t.clean
  const settled = useSettled(summary)
  React.useEffect(() => setNotice(""), [text])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? textarea.current)?.focus()
    refocus.current = null
  }, [text])
  const fix = (issue: DockerIssue, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(issue.fix ?? text)
  }
  /** Fixes re-run the check between each, since one fix can move the lines another points at. */
  const fixAll = () => {
    let next = text
    for (let round = 0; round < 30; round++) {
      const first = checkDockerfile(next, { dockerignore }).find((issue) => issue.severity !== "info" && issue.fix)
      if (!first?.fix || first.fix === next) break
      next = first.fix
    }
    refocus.current = 0
    update(next)
  }
  const reveal = (line: number) => {
    const el = textarea.current
    if (!el) return
    const rowsText = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)
    const newline = text.includes("\r\n") ? 2 : 1
    const start = rowsText.slice(0, line).reduce((sum, row) => sum + row.length + newline, text.startsWith("\uFEFF") ? 1 : 0)
    el.focus()
    el.setSelectionRange(start, start + (rowsText[line]?.length ?? 0))
  }
  const copyStarter = async () => {
    try {
      await navigator.clipboard.writeText(STARTER_DOCKERIGNORE)
      setCopied(true)
      setNotice(t.copiedStatus)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setNotice(t.copyFailed)
    }
  }
  const describe = (issue: DockerIssue) => {
    const [a = "", b = "", c = ""] = (issue.detail ?? "").split("|")
    if (issue.kind === "root-user" && a === "drops") return fill(t["root-user-drops"], { image: b })
    if (issue.kind === "root-user" && issue.detail === "ContainerUser") return t["root-user-windows"]
    if (issue.kind === "dockerignore") return dockerignore === null ? t.dockerignoreMissing : issue.detail ? fill(t.dockerignoreGaps, { detail: issue.detail }) : t.dockerignore
    if (issue.kind === "secret-arg" || issue.kind === "secret-env") return fill(c === "runtime" ? t["secret-env-runtime"] : t[issue.kind], { key: a, command: b })
    if (issue.kind === "secret-file" || issue.kind === "stage-leak") return fill(t[issue.kind], { file: a, copy: b, command: c })
    if (issue.kind === "apt") return issue.detail?.startsWith("-y") ? fill(t.apt, { detail: issue.detail.replace(/^-y(, )?/, "") || "-" }) : fill(t.aptBloat, { detail: issue.detail ?? "" })
    return fill(t[issue.kind], { detail: issue.detail ?? "" })
  }
  const fixLabel = (issue: DockerIssue) => {
    const key = issue.kind.startsWith("secret") || issue.kind === "stage-leak" ? "fix-secret" : issue.kind === "entrypoint-shell" ? "fix-shell-form" : `fix-${issue.kind}`
    return fill((t as Record<string, string>)[key] ?? t.fix, { detail: issue.detail ?? "" })
  }

  return (
    <div data-slot="dockerfile-check" className={cn("grid w-full max-w-xl min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="w-fit font-mono font-medium">
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
        wrap="off"
        placeholder={t.placeholder}
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-base leading-5 shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-xs dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {notice || settled}
      </span>
      <div id={`${inputId}-status`} className="mt-1.5 grid gap-1.5 text-xs empty:hidden">
        {image && (
          <span className={cn("flex items-start gap-1.5", image.user ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
            <Layers aria-hidden className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {fill(t.summary, { image: image.image || "?", stages: image.stages === 1 ? t.oneStage : fill(t.manyStages, { count: image.stages }), user: image.user ? fill(t.runsAs, { user: image.user }) : image.windows ? t.runsAsAdmin : t.runsAsRoot })}
            </span>
          </span>
        )}
        {summary && (
          <span className="flex min-h-6 flex-wrap items-center justify-between gap-2">
            <span className={cn("flex items-center gap-1.5", counted.length ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
              {counted.length ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
              {summary}
            </span>
            {fixable.length > 1 && (
              <button type="button" onClick={fixAll} className={fixClass(false)}>
                <WandSparkles aria-hidden className="size-3.5" />
                {fill(t.fixAll, { count: fixable.length })}
              </button>
            )}
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <ul ref={list} className="grid gap-1.5 text-xs">
          {issues.map((issue) => {
            const Icon = icons[issue.severity]
            return (
              <li key={`${issue.line}-${issue.kind}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                <span className="flex h-6 shrink-0 items-center">
                  <Icon aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 py-1 [overflow-wrap:anywhere]">
                    <button type="button" onClick={() => reveal(issue.line)} aria-label={fill(t.selectLine, { line: issue.line + 1 })} className="mr-1 rounded font-mono whitespace-nowrap text-muted-foreground tabular-nums underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {fill(t.line, { line: issue.line + 1 })}
                    </button>
                    {describe(issue)}
                  </span>
                  {issue.fix !== undefined && (
                    <button type="button" data-fix="" onClick={(event) => fix(issue, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                      {fixLabel(issue)}
                    </button>
                  )}
                  {issue.kind === "dockerignore" && (
                    <button type="button" onClick={copyStarter} className={fixClass(false)}>
                      {copied ? <CircleCheck aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                      {copied ? t.copied : t.copyStarter}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
