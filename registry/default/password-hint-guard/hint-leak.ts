/** Pure check for a password hint or security answer that gives the password away. No React. */

export type HintLeak =
  | { kind: "whole"; start: number; end: number; reversed: boolean }
  | { kind: "part"; start: number; end: number; length: number; total: number; reversed: boolean }
  | { kind: "reuse"; start: number; end: number }

// Look-alikes folded together so "P@ssw0rd" and "password", or "t-u-s-h-a-r" and "tushar", compare equal.
const FOLD: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", l: "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s", "7": "t" }

/** Folded text plus, for each folded character, its index in the original. Separators are dropped, and so are symbols when `dropSymbols` is set. */
function fold(text: string, dropSymbols = false) {
  let out = ""
  const map: number[] = []
  ;[...text.toLowerCase()].forEach((c, i) => {
    const f = dropSymbols && !/[\p{L}\p{N}]/u.test(c) ? "" : FOLD[c] ?? c
    if (/[\p{L}\p{N}]/u.test(f)) {
      out += f
      map.push(i)
    }
  })
  return { out, map }
}

/** Longest common substring of a and b: [start in a, length]. */
function longestCommon(a: string, b: string): [number, number] {
  let best: [number, number] = [0, 0]
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const row = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1
        if (row[j] > best[1]) best = [i - row[j], row[j]]
      }
    }
    prev = row
  }
  return best
}

// "same as my bank password", "same as facebook", "my usual pin": tells anyone the password is reused.
const REUSE = /\bsame\s+(?:as|like)\b[^.,;]*|\b(?:my\s+)?usual\s+(?:password|passcode|pin|one)\b/i

/**
 * The way a hint leaks the password, or null. Catches the password inside the
 * hint (also reversed, spaced out or in leetspeak), a run of 4+ of its
 * characters that makes up a third of it or more, and hints that announce reuse.
 * Positions are in the hint, so the leak can be highlighted without showing the password.
 */
export function findHintLeak(hint: string, password: string, minRun = 4): HintLeak | null {
  const h = fold(hint)
  const p = fold(password).out.slice(0, 128)
  if (!h.out || p.length < 3) return reuse(hint)
  const span = (start: number, length: number) => ({ start: h.map[start], end: h.map[start + length - 1] + 1 })
  // "Bongo@2019" is checked both as "bongoa2oi9" (leetspeak) and "bongo2oi9" (symbol left out of the hint).
  const bare = fold(password, true).out.slice(0, 128)
  const forms = [...new Set([p, bare])].filter((f) => f.length >= 3)
  const needles = forms.flatMap((f) => [[f, false], [[...f].reverse().join(""), true]] as const)
  for (const [needle, isReversed] of needles) {
    const at = h.out.indexOf(needle)
    if (at >= 0) return { kind: "whole", ...span(at, needle.length), reversed: isReversed }
  }
  let found: Extract<HintLeak, { kind: "part" }> | null = null
  for (const [needle, isReversed] of needles) {
    const [start, length] = longestCommon(h.out.slice(0, 256), needle)
    if (length >= Math.min(minRun, needle.length) && length >= needle.length / 3 && (!found || length / needle.length > found.length / found.total))
      found = { kind: "part", ...span(start, length), length, total: p.length, reversed: isReversed }
  }
  return found ?? reuse(hint)
}

function reuse(hint: string): HintLeak | null {
  const m = REUSE.exec(hint)
  return m ? { kind: "reuse", start: m.index, end: m.index + m[0].length } : null
}

/** The hint with the leaking span cut out and spacing tidied. */
export const removeLeak = (hint: string, leak: { start: number; end: number }) =>
  (hint.slice(0, leak.start) + hint.slice(leak.end)).replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim()
