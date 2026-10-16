"use client"

import * as React from "react"
import { ClipboardCheck, ListChecks } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ConsentItem {
  id: string
  /** The checkbox label, e.g. "Product news by email". */
  label: string
  /** What it means in practice, shown under the label. */
  description?: string
  /** Needed to use the service at all (terms). Kept apart from optional purposes. */
  required?: boolean
  /** How it reads in the summary, e.g. "product news by email". Defaults to the lowercased label. */
  readback?: string
}

export type ConsentChoices = Record<string, boolean>

export interface ConsentRecord {
  /** The consent text version the person saw. */
  version: string
  /** Fingerprint of the exact wording shown, so the record proves which text was agreed to. */
  textHash: string
  /** ISO timestamp of the choice. */
  at: string
  method: "individual" | "accept-all" | "decline-optional"
  choices: ConsentChoices
}

/** FNV-1a fingerprint of the version plus every label and description, as 8 hex characters. */
export function consentTextHash(items: ConsentItem[], version: string) {
  const text = [version, ...items.map((item) => `${item.id}|${item.label}|${item.description ?? ""}|${item.required ? 1 : 0}`)].join("\n")
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

const said = (item: ConsentItem) => item.readback ?? item.label.charAt(0).toLowerCase() + item.label.slice(1)
const join = (parts: string[], word = "and") => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${word} ${parts.at(-1)}` : (parts[0] ?? ""))

/** One plain sentence of what was agreed to and what was not. */
export function consentReadback(items: ConsentItem[], choices: ConsentChoices, agree = "You agree to {list}.", decline = "Not {list}.", none = "Nothing agreed yet.") {
  const yes = items.filter((item) => choices[item.id]).map(said)
  const no = items.filter((item) => !item.required && !choices[item.id]).map(said)
  if (!yes.length) return none
  return [agree.replace("{list}", join(yes)), no.length ? decline.replace("{list}", join(no, "or")) : ""].join(" ").trim()
}

/** True when every required item is ticked. */
export const consentComplete = (items: ConsentItem[], choices: ConsentChoices) => items.every((item) => !item.required || choices[item.id])

const button =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const checkbox = "mt-0.5 size-4 shrink-0 accent-primary rounded outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ConsentGroupProps extends Omit<React.ComponentProps<"fieldset">, "onChange"> {
  /** The consent checkboxes, required and optional. */
  items: ConsentItem[]
  /** Version of this consent text, stored in every record. */
  version: string
  /**
   * Controlled choices, e.g. a person's saved record when they edit it. There
   * is deliberately no `defaultValue`: uncontrolled, every box starts unticked.
   */
  value?: ConsentChoices
  /** Called with the new choices and the record to store. */
  onValueChange?: (choices: ConsentChoices, record: ConsentRecord) => void
  /** Adds a hidden input carrying the JSON record, for plain form posts. */
  name?: string
  /** Visible title for the group. */
  legend?: string
  /** Heading for the required items. */
  requiredHeading?: string
  /** Heading for the optional purposes. */
  optionalHeading?: string
  /** Text for the accept-all button. */
  acceptAllLabel?: string
  /** Text for the decline-optional button. */
  declineLabel?: string
  /** `{list}` is what Accept all would tick. */
  acceptAllText?: string
  /** Text for confirming accept-all. */
  confirmLabel?: string
  /** Text for cancelling accept-all. */
  cancelLabel?: string
  /** `{when}` and `{version}` are filled in. */
  recordedText?: string
}

/**
 * Consent that holds up later. Boxes are never pre-ticked, required terms sit
 * apart from optional purposes, and "Accept all" first spells out exactly
 * what it will tick before it does, next to an equally easy "Decline
 * optional". One plain sentence reads back what you agreed to, and each
 * change produces a record of the choices, time, method, version and a
 * fingerprint of the wording that was on screen.
 */
export function ConsentGroup({
  items,
  version,
  value,
  onValueChange,
  name,
  legend = "Your choices",
  requiredHeading = "Needed for your account",
  optionalHeading = "Optional, your choice",
  acceptAllLabel = "Accept all",
  declineLabel = "Decline optional",
  acceptAllText = "This also ticks {list}.",
  confirmLabel = "Tick them",
  cancelLabel = "Cancel",
  recordedText = "Recorded {when} · text {version}",
  className,
  ...props
}: ConsentGroupProps) {
  const [inner, setInner] = React.useState<ConsentChoices>({})
  const [record, setRecord] = React.useState<ConsentRecord>()
  const [confirming, setConfirming] = React.useState(false)
  const [flash, setFlash] = React.useState(0)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const choices = value ?? inner
  const textHash = React.useMemo(() => consentTextHash(items, version), [items, version])

  React.useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const commit = (next: ConsentChoices, method: ConsentRecord["method"]) => {
    const full = Object.fromEntries(items.map((item) => [item.id, Boolean(next[item.id])]))
    const entry: ConsentRecord = { version, textHash, at: new Date().toISOString(), method, choices: full }
    if (value === undefined) setInner(full)
    setRecord(entry)
    setConfirming(false)
    setFlash((count) => count + 1)
    onValueChange?.(full, entry)
  }

  const unticked = items.filter((item) => !choices[item.id])
  const groups = [
    { heading: requiredHeading, list: items.filter((item) => item.required) },
    { heading: optionalHeading, list: items.filter((item) => !item.required) },
  ].filter((group) => group.list.length)

  return (
    <fieldset data-slot="consent-group" className={cn("m-0 grid w-full min-w-0 gap-3 border-0 p-0", className)} {...props}>
      <style>{`@keyframes cui-consent-group-in{from{opacity:0;transform:translateY(-4px)}}@keyframes cui-consent-group-flash{from{background-color:color-mix(in oklab,var(--primary) 12%,transparent)}}`}</style>
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      {groups.map((group) => (
        <div key={group.heading} role="group" aria-labelledby={`${id}-${group.heading}`} className="grid gap-2">
          <p id={`${id}-${group.heading}`} className="text-xs font-medium text-muted-foreground">{group.heading}</p>
          {group.list.map((item) => (
            <label key={item.id} className="flex cursor-pointer gap-2.5 rounded-md border px-3 py-2 text-sm has-checked:border-primary/40 has-checked:bg-accent/40 transition-colors">
              <input
                type="checkbox"
                className={checkbox}
                checked={Boolean(choices[item.id])}
                required={item.required}
                aria-describedby={item.description ? `${id}-${item.id}` : undefined}
                onChange={(event) => commit({ ...choices, [item.id]: event.target.checked }, "individual")}
              />
              <span className="grid min-w-0 gap-0.5">
                <span className="font-medium">
                  {item.label}
                  {item.required && <span aria-hidden className="text-muted-foreground"> *</span>}
                </span>
                {item.description && <span id={`${id}-${item.id}`} className="text-xs text-muted-foreground">{item.description}</span>}
              </span>
            </label>
          ))}
        </div>
      ))}

      {confirming ? (
        <div
          role="group"
          aria-label={acceptAllLabel}
          onKeyDown={(event) => event.key === "Escape" && setConfirming(false)}
          className="grid gap-2 rounded-md border bg-muted/50 p-3 text-sm motion-safe:animate-[cui-consent-group-in_200ms_ease-out]"
        >
          <p className="flex gap-2">
            <ListChecks aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {acceptAllText.replace("{list}", join(unticked.map((item) => item.label)))}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={cn(button, "hover:bg-accent")}>{cancelLabel}</button>
            <button ref={confirmRef} type="button" onClick={() => commit(Object.fromEntries(items.map((item) => [item.id, true])), "accept-all")} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => commit(Object.fromEntries(items.map((item) => [item.id, item.required ? Boolean(choices[item.id]) : false])), "decline-optional")} className={cn(button, "border shadow-xs hover:bg-accent dark:bg-input/30")}>
            {declineLabel}
          </button>
          <button type="button" disabled={!unticked.length} onClick={() => setConfirming(true)} className={cn(button, "border shadow-xs hover:bg-accent disabled:opacity-50 dark:bg-input/30")}>
            {acceptAllLabel}
          </button>
        </div>
      )}

      <div key={flash} aria-live="polite" className="grid gap-1 rounded-md px-1 py-1 text-sm motion-safe:animate-[cui-consent-group-flash_400ms_ease-out]">
        <p className="flex gap-2">
          <ClipboardCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{consentReadback(items, choices)}</span>
        </p>
        {record && (
          <p className="pl-6 text-xs text-muted-foreground tabular-nums">
            {recordedText.replace("{when}", new Date(record.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })).replace("{version}", `${record.version} #${record.textHash}`)}
          </p>
        )}
      </div>
      {name && <input type="hidden" name={name} value={record ? JSON.stringify(record) : ""} />}
    </fieldset>
  )
}
