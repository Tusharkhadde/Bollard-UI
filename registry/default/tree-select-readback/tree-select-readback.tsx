"use client"

// Bollard UI — tree-select-readback · MIT licence · https://bollard-ui.vercel.app/components/tree-select-readback

import * as React from "react"
import { ChevronRight, ListTree, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
  /** `false` for a fixed set (days of the week): ticking the parent then never includes items added later. */
  growing?: boolean
}

type Index = Map<string, { node: TreeNode; parent?: string; leaves: string[] }>

function indexTree(tree: TreeNode[]): Index {
  const index: Index = new Map()
  const walk = (node: TreeNode, parent?: string): string[] => {
    const leaves = node.children?.length ? node.children.flatMap((child) => walk(child, node.id)) : [node.id]
    index.set(node.id, { node, parent, leaves })
    return leaves
  }
  tree.forEach((node) => walk(node))
  return index
}

const isRule = (index: Index, id: string) => !!index.get(id)?.node.children?.length
const ancestors = (index: Index, id: string) => {
  const out: string[] = []
  for (let p = index.get(id)?.parent; p; p = index.get(p)?.parent) out.push(p)
  return out
}

/** Splits a value into whole-group rules (parent ids, which include future children) and the leaf ids it selects today. */
export function resolveSelection(tree: TreeNode[], value: string[], index = indexTree(tree)) {
  const rules = new Set(value.filter((id) => isRule(index, id)))
  const leaves = new Set(value.flatMap((id) => index.get(id)?.leaves ?? []))
  return { rules, leaves }
}

function compact(index: Index, rules: Set<string>, leaves: Set<string>) {
  const top = [...rules].filter((id) => !ancestors(index, id).some((a) => rules.has(a)))
  const covered = new Set(top.flatMap((id) => index.get(id)?.leaves ?? []))
  return [...top, ...[...leaves].filter((id) => !covered.has(id))]
}

/**
 * Ticks or unticks a node. Ticking a growing parent stores it as a whole-group
 * rule; unticking anything beneath a rule breaks the rule into today's items,
 * so "all except" never quietly keeps picking up new ones.
 */
export function toggleNode(tree: TreeNode[], value: string[], id: string) {
  const index = indexTree(tree)
  const entry = index.get(id)
  if (!entry) return value
  const { rules, leaves } = resolveSelection(tree, value, index)
  const below = (rule: string) => rule === id || ancestors(index, rule).includes(id)
  if (entry.leaves.every((leaf) => leaves.has(leaf))) {
    entry.leaves.forEach((leaf) => leaves.delete(leaf))
    for (const rule of [...rules]) if (below(rule) || ancestors(index, id).includes(rule)) rules.delete(rule)
  } else {
    entry.leaves.forEach((leaf) => leaves.add(leaf))
    for (const rule of [...rules]) if (below(rule)) rules.delete(rule)
    if (entry.node.children?.length && entry.node.growing !== false) rules.add(id)
  }
  return compact(index, rules, leaves)
}

const names = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`)

/** A plain-English readback: "All of Marketing except Paid ads; 3 of 12 in Sales". */
export function describeSelection(tree: TreeNode[], value: string[]) {
  const index = indexTree(tree)
  const { rules, leaves } = resolveSelection(tree, value, index)
  const label = (id: string) => index.get(id)?.node.label ?? id
  const describe = (node: TreeNode, path: string): string[] => {
    const all = index.get(node.id)?.leaves ?? []
    const picked = all.filter((leaf) => leaves.has(leaf))
    if (!picked.length) return []
    if (!node.children?.length) return [path]
    if (rules.has(node.id)) return [`All of ${path}`]
    if (picked.length === all.length) return [`All ${all.length} in ${path}`]
    const missing = all.filter((leaf) => !leaves.has(leaf))
    if (missing.length <= 2 && picked.length > missing.length) return [`All of ${path} except ${names(missing.map(label))}`]
    if (picked.length <= 2) return [`${names(picked.map(label))} in ${path}`]
    const someChildFull = node.children.some((c) => c.children?.length && (index.get(c.id)?.leaves ?? []).every((l) => leaves.has(l)))
    return someChildFull ? node.children.flatMap((c) => describe(c, `${path} › ${c.label}`)) : [`${picked.length} of ${all.length} in ${path}`]
  }
  return tree.flatMap((node) => describe(node, node.label))
}

export interface TreeSelectReadbackProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Legend for the tree. */
  label?: string
  /** The options. */
  tree: TreeNode[]
  /** Controlled selection: leaf ids, plus parent ids meaning "the whole group, including items added later". */
  value?: string[]
  /** Initial selection when uncontrolled. */
  defaultValue?: string[]
  /** Called with the new selection and the leaf ids it covers today. */
  onValueChange?: (value: string[], leaves: string[]) => void
  /** Parents shown open at first. Defaults to every top-level group. */
  defaultExpanded?: string[]
  /** Shown when nothing is selected. */
  emptyText?: string
  /** Templates: `{groups}` and `{count}` are filled in. */
  futureText?: string
  /** Label of the pin-to-today's-items fix. */
  pinLabel?: string
  /** Badge next to a group ticked as a whole. */
  newBadge?: string
}

/**
 * A nested checkbox tree with tri-state parents that reads the selection back
 * in plain words ("All of Marketing except Paid ads; 3 of 12 in Sales"). It
 * tells "ticked the whole group" apart from "ticked every item", and warns
 * that a whole-group tick also selects items added later, with a one-tap way
 * to pin it to today's items.
 */
export function TreeSelectReadback({
  label = "Select",
  tree,
  value,
  defaultValue = [],
  onValueChange,
  defaultExpanded,
  emptyText = "Nothing selected yet.",
  futureText = "{groups} {verb} ticked as a whole, so anything added later is selected too.",
  pinLabel = "Only the {count} there now",
  newBadge = "+ new",
  className,
  ...props
}: TreeSelectReadbackProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [expanded, setExpanded] = React.useState(() => new Set(defaultExpanded ?? tree.map((n) => n.id)))
  const id = React.useId()
  const selection = value ?? inner
  const index = React.useMemo(() => indexTree(tree), [tree])
  const { rules, leaves } = resolveSelection(tree, selection, index)

  const update = (next: string[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next, [...resolveSelection(tree, next, index).leaves])
  }
  const growingRules = [...rules].filter((r) => index.get(r)?.node.growing !== false)
  const pin = () => update(compact(index, new Set(), leaves))
  const summary = describeSelection(tree, selection)
  const total = [...index.values()].filter((e) => !e.node.children?.length).length
  const pinnedCount = growingRules.reduce((n, r) => n + (index.get(r)?.leaves.length ?? 0), 0)

  const renderNode = (node: TreeNode, level: number): React.ReactNode => {
    const all = index.get(node.id)?.leaves ?? []
    const picked = all.filter((leaf) => leaves.has(leaf)).length
    const state = picked === 0 ? "off" : picked === all.length ? "on" : "mixed"
    const isParent = !!node.children?.length
    const open = expanded.has(node.id)
    const groupId = `${id}-${node.id}`
    return (
      <li key={node.id}>
        <div className="flex h-8 items-center gap-1.5 rounded-md pr-2 hover:bg-accent/50" style={{ paddingLeft: level * 20 }}>
          {isParent ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={groupId}
              aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
              onClick={() => setExpanded((prev) => new Set(prev.has(node.id) ? [...prev].filter((x) => x !== node.id) : [...prev, node.id]))}
              className="grid size-6 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronRight aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")} />
            </button>
          ) : (
            <span className="size-6" />
          )}
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state === "on"}
              ref={(el) => {
                if (el) el.indeterminate = state === "mixed"
              }}
              onChange={() => update(toggleNode(tree, selection, node.id))}
              className="size-4 shrink-0 rounded accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <span className={cn("truncate", isParent && "font-medium")}>{node.label}</span>
            {rules.has(node.id) && node.growing !== false && (
              <span className="shrink-0 rounded-sm bg-amber-500/15 px-1 text-[11px] font-medium text-amber-800 motion-safe:animate-[cui-tree-select-readback-pop_250ms_ease-out] dark:text-amber-300">
                {newBadge}
              </span>
            )}
          </label>
          {isParent && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {picked}/{all.length}
            </span>
          )}
        </div>
        {isParent && (
          <ul id={groupId} hidden={!open} role="group" aria-label={node.label}>
            {node.children?.map((child) => renderNode(child, level + 1))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <fieldset data-slot="tree-select-readback" className={cn("grid w-full max-w-sm min-w-0 gap-1.5", className)} {...props}>
      <style>{"@keyframes cui-tree-select-readback-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}"}</style>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <ul className="max-h-80 overflow-auto rounded-md border p-1 shadow-xs dark:bg-input/30">{tree.map((node) => renderNode(node, 0))}</ul>
      <div aria-live="polite" className="grid gap-1 text-xs">
        <p className="flex gap-1.5 text-muted-foreground">
          <span className="flex h-6 shrink-0 items-center">
            <ListTree aria-hidden className="size-3.5" />
          </span>
          <span className="py-1" data-readback>
            {summary.length ? `${summary.join("; ")}. ${leaves.size} of ${total} selected.` : emptyText}
          </span>
        </p>
        {growingRules.length > 0 && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400" data-warning="future">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">
                {futureText
                  .replace("{groups}", names(growingRules.map((r) => index.get(r)?.node.label ?? r)))
                  .replace("{verb}", growingRules.length === 1 ? "is" : "are")}
              </span>
              <button
                type="button"
                onClick={pin}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {pinLabel.replace("{count}", String(pinnedCount))}
              </button>
            </span>
          </p>
        )}
      </div>
    </fieldset>
  )
}
