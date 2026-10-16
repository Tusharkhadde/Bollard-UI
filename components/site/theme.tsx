"use client"

import * as React from "react"
import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

import { THEME_KEY } from "@/lib/theme-script"

export type ThemeChoice = "light" | "dark" | "system"

const listeners = new Set<() => void>()

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {}
  apply(choice)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const onSystem = () => {
    if (readChoice() === "system") apply("system")
    listener()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return
    apply(readChoice())
    listener()
  }
  media.addEventListener("change", onSystem)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", onSystem)
    window.removeEventListener("storage", onStorage)
  }
}

/** The stored choice ("system" until the user picks one). */
export function useThemeChoice() {
  return React.useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice)
}

/** Whether the page is dark right now, after resolving "system". */
export function useResolvedDark() {
  return React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  )
}

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const choice = useThemeChoice()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("inline-flex items-center rounded-lg border p-0.5", className)}>
      {options.map(({ value, label, icon: Icon }) => {
        const checked = mounted && choice === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            data-theme-option={value}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              checked && "bg-accent text-foreground shadow-xs",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

const nextChoice: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" }

/** One icon button for tight spots (the top bar): cycles light → dark → system and says which one is on. */
export function ThemeButton({ className }: { className?: string }) {
  const choice = useThemeChoice()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const current = options.find((o) => o.value === (mounted ? choice : "system")) ?? options[2]
  const next = options.find((o) => o.value === nextChoice[current.value])!
  const Icon = current.icon
  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label.toLowerCase()}`}
      title={`Theme: ${current.label}`}
      data-theme-button
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
