/**
 * Shortcuts are stored platform-neutral: `Mod` is ⌘ on Mac and Ctrl elsewhere, `Ctrl` is the
 * Mac ⌃ key, then `Alt`, `Shift` and the key, e.g. "Mod+Shift+K".
 */
export type Platform = "mac" | "windows" | "linux"

export interface ShortcutBinding {
  /** Canonical shortcut, e.g. "Mod+K". */
  keys: string
  /** What it does, e.g. "Open search". */
  action: string
}

export type ShortcutProblem = "reserved" | "browser" | "app" | "altgr" | "layout" | "option" | "no-modifier"

export interface ShortcutIssue {
  problem: ShortcutProblem
  message: string
  /** Blocking issues can't be saved: the browser or OS never hands that key to the page. */
  blocking: boolean
}

const PLATFORMS: Platform[] = ["mac", "windows", "linux"]

/** Combos the browser or OS keeps for itself, in resolved form (Ctrl, Meta, Alt, Shift, key). */
const RESERVED: Record<"mac" | "pc", Record<string, string>> = {
  mac: {
    "Meta+W": "closes the tab", "Meta+T": "opens a new tab", "Meta+N": "opens a new window", "Meta+Q": "quits the browser",
    "Meta+Shift+N": "opens a private window", "Meta+Shift+T": "reopens a closed tab", "Meta+Shift+W": "closes the window",
    "Meta+H": "hides the browser", "Meta+M": "minimizes the window", "Meta+Tab": "switches apps", "Meta+Space": "opens Spotlight",
    "Ctrl+Space": "switches input source", "Meta+`": "switches windows", "Meta+Shift+3": "takes a screenshot",
    "Meta+Shift+4": "takes a screenshot", "Meta+Shift+5": "opens screenshot tools", "Ctrl+Tab": "switches tabs",
    "Ctrl+Shift+Tab": "switches tabs", "Meta+Alt+Escape": "opens Force Quit", "Ctrl+↑": "opens Mission Control",
    "Ctrl+←": "switches desktops", "Ctrl+→": "switches desktops",
  },
  pc: {
    "Ctrl+W": "closes the tab", "Ctrl+T": "opens a new tab", "Ctrl+N": "opens a new window", "Ctrl+Shift+N": "opens a private window",
    "Ctrl+Shift+T": "reopens a closed tab", "Ctrl+Shift+W": "closes the window", "Ctrl+Shift+Q": "quits the browser",
    "Ctrl+Tab": "switches tabs", "Ctrl+Shift+Tab": "switches tabs", "Ctrl+PageUp": "switches tabs", "Ctrl+PageDown": "switches tabs",
    "Alt+F4": "closes the window", "Alt+Tab": "switches apps", "Ctrl+Alt+Delete": "opens the security screen",
  },
}
/** Combos the page can take over, but users expect the browser's meaning. */
const FAMILIAR: Record<string, string> = {
  S: "Save page", P: "Print", F: "Find", R: "Reload", L: "the address bar", D: "Bookmark", C: "Copy", V: "Paste",
  X: "Cut", Z: "Undo", A: "Select all", "Shift+I": "developer tools", "0": "reset zoom", "=": "zoom in", "-": "zoom out",
}
/** Keys that need AltGr or Shift on German, French or Nordic layouts. */
const LAYOUT_KEYS: Record<string, string> = {
  "[": "AltGr+8 on German keyboards", "]": "AltGr+9 on German keyboards", "\\": "AltGr+ß on German keyboards",
  "/": "Shift+7 on German keyboards", ";": "Shift+, on German keyboards", "'": "Shift+# on German keyboards",
  "`": "a dead key on German and French keyboards", "=": "Shift+0 on German keyboards",
}

const CODE_NAMES: Record<string, string> = {
  BracketLeft: "[", BracketRight: "]", Backslash: "\\", Slash: "/", Semicolon: ";", Quote: "'", Backquote: "`",
  Equal: "=", Minus: "-", Comma: ",", Period: ".", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
}
const MODIFIER_KEYS = ["Control", "Shift", "Alt", "Meta", "AltGraph", "OS", "CapsLock", "Fn"]

/** Detects the platform from the browser. Call it in an effect, never during render. */
export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  return /Mac|iPhone|iPad/.test(ua) ? "mac" : /Win/.test(ua) ? "windows" : "linux"
}

export const isModifierKey = (key: string) => MODIFIER_KEYS.includes(key)

/** Turns a keydown into the canonical form, or null while only modifiers are held. */
export function shortcutFromEvent(event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">, platform: Platform) {
  if (isModifierKey(event.key)) return null
  const key = /^Key[A-Z]$/.test(event.code) ? (/^[a-z]$/i.test(event.key) ? event.key.toUpperCase() : event.code.slice(3))
    : /^Digit\d$/.test(event.code) ? event.code.slice(5)
    : CODE_NAMES[event.code] ?? (event.key === " " ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key)
  const mac = platform === "mac"
  return [
    (mac ? event.metaKey : event.ctrlKey) && "Mod",
    (mac ? event.ctrlKey : event.metaKey) && (mac ? "Ctrl" : "Meta"),
    event.altKey && "Alt",
    event.shiftKey && "Shift",
    key,
  ].filter(Boolean).join("+")
}

/** The physical keys a canonical shortcut means on one platform: Ctrl, Meta, Alt, Shift, then the key. */
export function resolveShortcut(keys: string, platform: Platform) {
  const parts = keys.split("+")
  const key = parts.pop() || "+"
  const has = (m: string) => parts.includes(m)
  const mac = platform === "mac"
  const ctrl = mac ? has("Ctrl") : has("Mod") || has("Ctrl")
  const meta = mac ? has("Mod") || has("Meta") : has("Meta") || (has("Mod") && has("Ctrl"))
  return [ctrl && "Ctrl", meta && "Meta", has("Alt") && "Alt", has("Shift") && "Shift", key].filter(Boolean).join("+")
}

/** How the shortcut reads on a platform: ⌃⌥⇧⌘K on Mac, Ctrl+Alt+Shift+K on Windows, Super on Linux. */
export function formatShortcut(keys: string, platform: Platform) {
  const parts = resolveShortcut(keys, platform).split("+")
  if (platform === "mac") {
    const symbols: Record<string, string> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘", Escape: "⎋", Enter: "↩", Backspace: "⌫", Delete: "⌦", Tab: "⇥" }
    return ["Ctrl", "Alt", "Shift", "Meta"].filter((m) => parts.includes(m)).map((m) => symbols[m]).join("") + (symbols[parts[parts.length - 1]] ?? parts[parts.length - 1])
  }
  return parts.map((p) => (p === "Meta" ? (platform === "windows" ? "Win" : "Super") : p)).join("+")
}

/**
 * Everything wrong with a shortcut on any platform it will run on: combos the browser or OS
 * never hands to the page (blocking), familiar browser commands it would take over, clashes
 * with the app's own bindings, Ctrl+Alt (which is AltGr on European layouts), punctuation that
 * needs AltGr on other layouts, Mac ⌥+letter, and plain keys that would fire while typing.
 */
export function checkShortcut(keys: string, bindings: ShortcutBinding[] = [], altGraph = false): ShortcutIssue[] {
  const issues: ShortcutIssue[] = []
  const key = keys.split("+").pop()!
  const mods = keys.split("+").slice(0, -1)
  const onMac = RESERVED.mac[resolveShortcut(keys, "mac")]
  const onPc = RESERVED.pc[resolveShortcut(keys, "windows")]
  const hits = onMac && onMac === onPc ? [`it ${onMac}`]
    : [onMac && `on Mac it ${onMac}`, onPc && `on Windows and Linux it ${onPc}`].filter((hit): hit is string => !!hit)
  if (hits.length) issues.push({ problem: "reserved", blocking: true, message: `Browsers keep this for themselves: ${hits.join(", and ")}.` })
  const onWindows = resolveShortcut(keys, "windows").split("+")
  if (onWindows.includes("Meta")) issues.push({ problem: "reserved", blocking: true, message: "On Windows this needs the Windows key, which belongs to the operating system." })
  if (!hits.length && mods.length === 1 && mods[0] === "Mod" && FAMILIAR[key])
    issues.push({ problem: "browser", blocking: false, message: `Replaces the browser's ${FAMILIAR[key]}, which people expect here.` })
  if (!hits.length && mods.join("+") === "Mod+Shift" && FAMILIAR[`Shift+${key}`])
    issues.push({ problem: "browser", blocking: false, message: `Replaces the browser's ${FAMILIAR[`Shift+${key}`]}.` })
  const clash = bindings.find((b) => PLATFORMS.some((p) => resolveShortcut(b.keys, p) === resolveShortcut(keys, p)))
  if (clash) issues.push({ problem: "app", blocking: false, message: `Already used for “${clash.action}”.` })
  if (altGraph) issues.push({ problem: "altgr", blocking: false, message: "Your layout needs AltGr for this key, so it may not work as recorded." })
  else if (onWindows.includes("Ctrl") && onWindows.includes("Alt") && !onWindows.includes("Meta"))
    issues.push({ problem: "altgr", blocking: false, message: `Ctrl+Alt is AltGr on many European layouts, so on Windows it can type a character instead (AltGr+E is €).` })
  if (LAYOUT_KEYS[key]) issues.push({ problem: "layout", blocking: false, message: `${key} is ${LAYOUT_KEYS[key]}, so some people can't press this.` })
  if (mods.join("+") === "Alt" && /^[A-Z]$/.test(key))
    issues.push({ problem: "option", blocking: false, message: `On Mac, ⌥${key} types a special character in text fields.` })
  if (!mods.some((m) => m !== "Shift") && /^[A-Z0-9]$|^Space$/.test(key))
    issues.push({ problem: "no-modifier", blocking: false, message: "With no modifier, this fires while people type." })
  return issues
}
