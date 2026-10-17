"use client"

// Bollard UI — role-preview · MIT licence · https://bollard-ui.vercel.app/components/role-preview

import * as React from "react"
import { Check, Minus, Plus, Sparkles, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RoleOption {
  id: string
  name: string
  description?: string
}

export interface Capability {
  id: string
  /** Phrased as an ability, e.g. "Delete projects". */
  label: string
  /** Mark capabilities that can cost money, destroy data or widen access. */
  dangerous?: boolean
}

export interface RoleSuggestion {
  /** The smaller role to offer instead. */
  role: RoleOption
  /** Dangerous capabilities of the pick that the smaller role leaves out. */
  avoided: Capability[]
}

/**
 * Least privilege: the smallest role that keeps every non-dangerous capability
 * of `roleId`, grants fewer of its dangerous ones and adds no new ones.
 * Returns null when none exists.
 */
export function suggestSmallerRole(
  roleId: string,
  roles: RoleOption[],
  capabilities: Capability[],
  matrix: Record<string, string[]>
): RoleSuggestion | null {
  const picked = new Set(matrix[roleId] ?? [])
  const dangerous = capabilities.filter((c) => c.dangerous && picked.has(c.id))
  const safe = capabilities.filter((c) => !c.dangerous && picked.has(c.id))
  const best = roles
    .filter((role) => role.id !== roleId)
    .map((role) => ({ role, grants: new Set(matrix[role.id] ?? []) }))
    .filter(
      ({ grants }) =>
        safe.every((c) => grants.has(c.id)) &&
        dangerous.some((c) => !grants.has(c.id)) &&
        capabilities.every((c) => !c.dangerous || picked.has(c.id) || !grants.has(c.id))
    )
    .sort((a, b) => a.grants.size - b.grants.size)[0]
  return best ? { role: best.role, avoided: dangerous.filter((c) => !best.grants.has(c.id)) } : null
}

export interface RolePreviewProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Roles in order from least to most access. */
  roles: RoleOption[]
  /** Everything a role can grant, in the order to list it. */
  capabilities: Capability[]
  /** Permissions matrix: role id to the capability ids it grants. */
  matrix: Record<string, string[]>
  /** The selected role id (controlled). */
  value?: string
  /** The initially selected role id when uncontrolled. */
  defaultValue?: string
  /** Called with the role id the user picks, including from the suggestion. */
  onValueChange?: (roleId: string) => void
  /** The person's role today, used to show what changes. Omit for new invites. */
  currentRole?: string
  /** Who you're choosing for, e.g. "Priya". */
  personName?: string
  /** Visible label of the role group. */
  label?: string
  /** Badge on the person's current role. */
  currentBadge?: string
  /** Badge on dangerous capabilities. */
  sensitiveBadge?: string
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
const list = (items: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(items)

/**
 * A role picker that spells out what the chosen role can and can't do,
 * flags dangerous capabilities, diffs against the current role, and offers a
 * smaller role when the pick grants dangerous access the person may not need.
 * Prevents handing out Admin "just to be safe".
 */
export function RolePreview({
  roles,
  capabilities,
  matrix,
  value,
  defaultValue,
  onValueChange,
  currentRole,
  personName,
  label = "Role",
  currentBadge = "Current",
  sensitiveBadge = "Sensitive",
  className,
  ...props
}: RolePreviewProps) {
  const name = React.useId()
  const [internal, setInternal] = React.useState(defaultValue ?? currentRole ?? roles[0]?.id ?? "")
  const selectedId = value ?? internal
  const select = (roleId: string) => {
    setInternal(roleId)
    onValueChange?.(roleId)
  }

  const selected = new Set(matrix[selectedId] ?? [])
  const current = new Set(currentRole ? matrix[currentRole] ?? [] : [])
  const changing = currentRole !== undefined && currentRole !== selectedId
  const gained = capabilities.filter((c) => selected.has(c.id) && !current.has(c.id))
  const lost = capabilities.filter((c) => !selected.has(c.id) && current.has(c.id))

  // Offer a smaller role for new invites, or when this change hands out new dangerous access.
  const suggestion =
    currentRole === undefined || gained.some((c) => c.dangerous)
      ? suggestSmallerRole(selectedId, roles, capabilities, matrix)
      : null
  const who = personName ?? "them"

  return (
    <div data-slot="role-preview" className={cn("w-full max-w-lg space-y-4", className)} {...props}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
          {roles.map((role) => (
            <label
              key={role.id}
              className="cursor-pointer rounded-lg border p-3 text-sm transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name={name}
                value={role.id}
                checked={selectedId === role.id}
                onChange={() => select(role.id)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2 font-medium">
                {role.name}
                {role.id === currentRole && <span className="text-xs font-normal text-muted-foreground">{currentBadge}</span>}
              </span>
              {role.description && <span className="mt-0.5 block text-xs text-muted-foreground">{role.description}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="space-y-2 empty:hidden">
        {changing && (gained.length > 0 || lost.length > 0) && (
          <ul className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm" aria-label="Changes from current role">
            {gained.map((c) => (
              <li
                key={c.id}
                className={cn("flex items-center gap-2", c.dangerous ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}
              >
                <Plus aria-hidden className="size-3.5 shrink-0" /> Can {lower(c.label)}
                {c.dangerous && <span className="sr-only">({sensitiveBadge})</span>}
              </li>
            ))}
            {lost.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-muted-foreground">
                <Minus aria-hidden className="size-3.5 shrink-0" /> Can no longer {lower(c.label)}
              </li>
            ))}
          </ul>
        )}

        {suggestion && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            <Sparkles aria-hidden className="size-4 shrink-0" />
            <p className="min-w-0 flex-1 basis-56">
              {roles.find((r) => r.id === selectedId)?.name} also lets {who} {list(suggestion.avoided.map((c) => lower(c.label)))}.{" "}
              {suggestion.role.name} covers everything else.
            </p>
            <button
              type="button"
              onClick={() => select(suggestion.role.id)}
              className="h-8 rounded-md border border-amber-400 bg-background/60 px-3 text-sm font-medium outline-none hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-500/50"
            >
              Use {suggestion.role.name}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <p className="border-b px-3 py-2 text-sm font-medium">{personName ?? "They"} will be able to</p>
        <ul className="divide-y text-sm">
          {capabilities.map((c) => {
            const can = selected.has(c.id)
            return (
              <li key={c.id} className={cn("flex items-center gap-2.5 px-3 py-2", !can && "text-muted-foreground")}>
                {can ? (
                  <Check aria-hidden className={cn("size-4 shrink-0", c.dangerous ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")} />
                ) : (
                  <X aria-hidden className="size-4 shrink-0 opacity-60" />
                )}
                <span className={cn("min-w-0 flex-1", !can && "line-through decoration-muted-foreground/40")}>
                  <span className="sr-only">{can ? "Can: " : "Cannot: "}</span>
                  {c.label}
                </span>
                {c.dangerous && can && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    <TriangleAlert aria-hidden className="size-3" /> {sensitiveBadge}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
