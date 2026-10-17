"use client"

// Bollard UI — chmod-input · MIT licence · https://bollard-ui.vercel.app/components/chmod-input

import * as React from "react"
import { CircleAlert, CircleCheck, Info, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkMode, inferKind, toOctal, toRwx, type FileKind, type ModeIssue } from "@/registry/default/chmod-input/chmod"

export { checkMode, inferKind, parseMode, toOctal, toRwx, type FileKind, type ModeIssue, type ModeIssueCode, type ModeOptions, type ParsedMode } from "@/registry/default/chmod-input/chmod"

export const CHMOD_INPUT_MESSAGES = {
  label: "Permissions",
  placeholder: "644, 0755, u+x or rwxr-xr-x",
  forName: "for {name}",
  owner: "Owner",
  group: "Group",
  others: "Everyone else",
  grid: "Who can do what",
  read: "Read",
  write: "Write",
  run: "Run",
  dirRead: "List",
  dirWrite: "Change",
  dirRun: "Open",
  verbRead: "read it",
  verbWrite: "change it",
  verbRun: "run it",
  dirVerbRead: "see what's inside",
  dirVerbWrite: "add or delete files",
  dirVerbRun: "open it",
  can: "{who} can {verbs}.",
  cannot: "{who}: no access.",
  and: " and ",
  special: "Special",
  specialSetuid: "setuid",
  specialSetgid: "setgid",
  specialSticky: "sticky",
  fromBase: "{input} on {base} gives {result}.",
  umask: "No u, g or o given, so your umask ({umask}) holds some bits back.",
  command: "chmod {octal} {name}",
  problems: "{count} things to check",
  fix: "Use {fix}",
  invalid: "Not a mode. Try 644, u+x or rwxr-xr-x.",
  decimal: "{input} looks like {detail} written in decimal, as code does when the 0o is missing (fs.chmod(path, {input})). As octal it means something else.",
  short: "chmod reads {input} as {detail}, so the owner gets nothing.",
  "world-writable": "Anyone on this machine can change this, including any compromised service.",
  "world-writable-dir": "Anyone can add, rename or delete files in here. Shared folders like /tmp need the sticky bit (1777).",
  "sticky-dir": "Everyone can write here, but the sticky bit stops them deleting each other's files, like /tmp.",
  setuid: "Setuid: it runs with its owner's rights (root, if root owns it), whoever starts it.",
  setgid: "Setgid: it runs with its group's rights, whoever starts it.",
  "setuid-dir": "Setuid does nothing on a directory on Linux.",
  "setgid-dir": "Setgid: new files here take this folder's group. Usually wanted for team folders.",
  "sticky-file": "The sticky bit is ignored on files.",
  "key-too-open": "ssh will refuse this key: “Permissions {detail} for '{name}' are too open.” A private key must be readable by you alone.",
  keyTooOpenFile: "Others on this machine can read this private key. Keep it readable by its owner alone (600, or 400).",
  "pem-too-open": "If this .pem holds a private key, ssh refuses it while others can read it. A certificate can stay 644.",
  "key-unreadable": "You can't read your own key, so ssh can't use it.",
  "ssh-dir-writable": "sshd ignores your keys while ~/.ssh is writable by others (StrictModes).",
  "ssh-dir-open": "~/.ssh should be yours alone.",
  "authorized-keys-writable": "sshd ignores authorized_keys while others can write to it, so key login stops working.",
  "ssh-config-writable": "ssh refuses to start while others can write to its config: “Bad owner or permissions on ~/.ssh/config”.",
  "home-writable": "sshd ignores every key in this account while the home folder is writable by others (StrictModes).",
  "secrets-world": "Every user and service on this machine can read these secrets.",
  "secrets-group": "Everyone in the group can read these secrets.",
  "public-writable": "Others could replace your public key.",
  "data-executable": "A data file never needs to run. Execute bits on data are usually a copy-paste leftover.",
  "script-not-executable": "The owner can't run this script directly (./{name}).",
  "dir-not-openable": "Without x, even the owner can't open this folder.",
  "group-writable": "Everyone in the group can change this. Most guides mean {detail}: 755 and 775 are one digit apart.",
  "owner-less": "The owner has less access than others. The digits may be the wrong way round.",
  "no-access": "Nobody but root can use this.",
}
export type ChmodInputMessages = typeof CHMOD_INPUT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { danger: "text-red-700 dark:text-red-400", error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { danger: ShieldAlert, error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (strong: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-mono font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    strong ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const CLASSES = [
  ["owner", 6],
  ["group", 3],
  ["others", 0],
] as const
const SPECIALS = [
  ["specialSetuid", 0o4000],
  ["specialSetgid", 0o2000],
  ["specialSticky", 0o1000],
] as const
const short = (mode: number) => (mode & 0o7000 ? toOctal(mode) : toOctal(mode).slice(1))

function useSettled(text: string, delay = 800) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface ChmodInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "name"> {
  /** Controlled text, exactly as typed (644, u+x, -rw-r--r--). */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the new text on every edit, toggle or fix. */
  onValueChange?: (value: string) => void
  /** Called with the resulting numeric mode, or null when the text isn't a mode. */
  onModeChange?: (mode: number | null) => void
  /** The file or folder this is for (~/.ssh/id_ed25519, uploads/). Its name decides which rules apply. */
  path?: string
  /** What it is, when the name doesn't say. Overrides the guess from `path`. */
  kind?: FileKind
  /** The current mode, the starting point for symbolic changes like u+x. */
  current?: number
  /** Umask for symbolic changes with no u/g/o. Default 0o022. */
  umask?: number
  /** The group is meant to share write access (a team folder), so 775 isn't flagged. */
  groupShared?: boolean
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{who}`, `{verbs}`, `{name}`, `{fix}`, `{detail}`, `{input}`, `{base}`, `{result}`, `{octal}` are filled in. */
  messages?: Partial<ChmodInputMessages>
}

/**
 * A file permission field that reads any mode (644, 0755, u+x,go-w, -rwxr-xr-x)
 * back as rwx and plain words, and stops the mistakes that cost access or leak
 * data: world-writable files, setuid and setgid, private keys and .env files
 * others can read, a writable ~/.ssh or authorized_keys, execute bits on data,
 * 775 typed for 755, short and decimal modes, and owner bits weaker than others'.
 */
export function ChmodInput({
  value,
  defaultValue = "",
  onValueChange,
  onModeChange,
  path,
  kind: kindProp,
  current,
  umask = 0o022,
  groupShared = false,
  label,
  messages,
  id,
  className,
  ref,
  "aria-describedby": describedBy,
  ...props
}: ChmodInputProps) {
  const t = { ...CHMOD_INPUT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  const field = React.useRef<HTMLInputElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  React.useImperativeHandle(ref, () => field.current as HTMLInputElement)

  const kind = kindProp ?? inferKind(path)
  const isDir = kind === "directory" || kind === "ssh-dir" || kind === "home-dir"
  const name = path?.replace(/\/+$/, "").split("/").pop() || path || ""
  // The full path, quoted when needed, so the suggested command can be pasted as is.
  const target = !path?.trim() ? "file" : /[\s'"$`\\]/.test(path.trim()) ? `'${path.trim().replace(/'/g, "'\\''")}'` : path.trim()
  const { parsed, issues } = React.useMemo(() => checkMode(text, kind, { current, umask, groupShared }), [text, kind, current, umask, groupShared])
  const mode = parsed.mode
  const blocking = issues.some((issue) => issue.severity === "error" || issue.severity === "danger")
  const counted = issues.filter((issue) => issue.severity !== "info")

  const verbs = isDir ? [t.dirVerbRead, t.dirVerbWrite, t.dirVerbRun] : [t.verbRead, t.verbWrite, t.verbRun]
  const sentences =
    mode === null
      ? []
      : CLASSES.map(([key, shift]) => {
          const bits = (mode >> shift) & 7
          const list = [4, 2, 1].flatMap((bit, i) => (bits & bit ? [verbs[i]] : []))
          return list.length ? fill(t.can, { who: t[key], verbs: list.join(t.and) }) : fill(t.cannot, { who: t[key] })
        })
  const summary = !text.trim() ? "" : counted.length ? fill(t.problems, { count: counted.length }) : sentences.join(" ")
  const announced = useSettled(summary)

  const onMode = React.useRef(onModeChange)
  onMode.current = onModeChange
  React.useEffect(() => onMode.current?.(mode), [mode])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? field.current)?.focus()
    refocus.current = null
  }, [text])
  const applyFix = (fix: number, button: HTMLElement) => {
    refocus.current = [...(panel.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(short(fix))
  }
  const toggle = (bit: number) => update(short((mode ?? 0) ^ bit))

  // The quoted ssh error only applies to ssh keys (id_*); a TLS or app key gets the plain version.
  const template = (issue: ModeIssue) => (issue.code === "key-too-open" && !/^id_/i.test(name) ? t.keyTooOpenFile : t[issue.code])
  const message = (issue: ModeIssue) =>
    fill(template(issue), {
      detail: issue.detail ?? "",
      name: name || "file",
      input: text.trim(),
    })
  const columns = isDir ? [t.dirRead, t.dirWrite, t.dirRun] : [t.read, t.write, t.run]

  return (
    <div data-slot="chmod-input" className={cn("grid w-full max-w-sm min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <label htmlFor={inputId} className="font-medium">
          {t.label}
        </label>
        {path && <span className="min-w-0 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{fill(t.forName, { name: path })}</span>}
      </div>
      <input
        ref={field}
        id={inputId}
        type="text"
        value={text}
        onChange={(event) => update(event.target.value)}
        placeholder={t.placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        aria-invalid={blocking || undefined}
        aria-describedby={[describedBy, `${inputId}-readback`, `${inputId}-report`].filter(Boolean).join(" ")}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {announced}
      </span>
      <div id={`${inputId}-readback`} className="grid gap-0.5 text-xs empty:hidden">
        {mode !== null && (
          <>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 font-mono">
              <span className="text-sm font-medium tracking-wider">{(isDir ? "d" : "-") + toRwx(mode)}</span>
              <span className="text-muted-foreground">{toOctal(mode)}</span>
            </p>
            <p className="text-muted-foreground">{sentences.join(" ")}</p>
            {parsed.form === "symbolic" && parsed.base !== undefined && (
              <p className="text-muted-foreground">
                {fill(t.fromBase, { input: text.trim(), base: short(parsed.base), result: short(mode) })} {parsed.umaskApplied && fill(t.umask, { umask: toOctal(umask).slice(1) })}
              </p>
            )}
          </>
        )}
      </div>
      <div ref={panel} id={`${inputId}-report`} className="grid gap-1 text-xs empty:hidden">
        {issues.map((issue) => {
          const Icon = icons[issue.severity]
          return (
            <p key={issue.code} role={issue.code === "invalid" ? "alert" : undefined} className={cn("flex gap-1.5", tones[issue.severity])}>
              <span className="flex h-6 shrink-0 items-center">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1 [overflow-wrap:anywhere]">{message(issue)}</span>
                {issue.fix !== undefined && (
                  <button type="button" data-fix="" onClick={(event) => applyFix(issue.fix ?? 0, event.currentTarget)} className={fixClass(issue.severity === "danger" || issue.severity === "error")}>
                    {fill(t.fix, { fix: short(issue.fix) })}
                  </button>
                )}
              </span>
            </p>
          )
        })}
        {mode !== null && !counted.length && (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5" />
            <code className="font-mono [overflow-wrap:anywhere]">{fill(t.command, { octal: short(mode), name: target })}</code>
          </p>
        )}
      </div>
      <fieldset className="mt-1.5 grid gap-1 rounded-md border p-2 text-xs">
        <legend className="px-1 text-muted-foreground">{t.grid}</legend>
        <table className="w-full table-fixed text-center">
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="w-2/5" />
              {columns.map((column) => (
                <th key={column} scope="col" className="py-1 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map(([key, shift]) => (
              <tr key={key}>
                <th scope="row" className="py-1 text-left font-medium">
                  {t[key]}
                </th>
                {[4, 2, 1].map((bit, i) => (
                  <td key={bit} className="py-1">
                    <input
                      type="checkbox"
                      checked={mode !== null && Boolean(mode & (bit << shift))}
                      onChange={() => toggle(bit << shift)}
                      aria-label={`${t[key]}: ${columns[i]}`}
                      className="size-4 cursor-pointer accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-1 pt-1.5">
          <span className="text-muted-foreground">{t.special}</span>
          {SPECIALS.map(([key, bit]) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5 font-mono">
              <input type="checkbox" checked={mode !== null && Boolean(mode & bit)} onChange={() => toggle(bit)} className="size-3.5 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
              {t[key]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
