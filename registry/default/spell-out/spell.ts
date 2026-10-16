/** ICAO/NATO spelling alphabet (ICAO spells Alfa and Juliett this way on purpose). */
export const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel", I: "India",
  J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X-ray", Y: "Yankee", Z: "Zulu",
}
const DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
const SYMBOLS: Record<string, string> = {
  "-": "hyphen", _: "underscore", ".": "dot", "@": "at sign", "/": "forward slash", "\\": "backslash", "#": "hash",
  "!": "exclamation mark", "?": "question mark", $: "dollar sign", "%": "percent sign", "&": "ampersand", "*": "asterisk",
  "+": "plus", "=": "equals", ":": "colon", ";": "semicolon", ",": "comma", "'": "apostrophe", '"': "double quote",
  "(": "open bracket", ")": "close bracket", "[": "open square bracket", "]": "close square bracket", "{": "open curly brace",
  "}": "close curly brace", "<": "less-than sign", ">": "greater-than sign", "~": "tilde", "`": "backtick", "^": "caret",
  "|": "vertical bar", " ": "space", "₹": "rupee sign", "€": "euro sign", "£": "pound sign",
}
/** Characters that get mixed up when read off a screen or copied by hand, with a short name to tell them apart. */
const CONFUSABLE: Record<string, string> = {
  "0": "zero", O: "oh", o: "oh", "1": "one", l: "el", I: "eye", i: "eye", "|": "bar", "5": "five", S: "ess", s: "ess",
  "2": "two", Z: "zed", z: "zed", "8": "eight", B: "bee", "6": "six", G: "gee", b: "bee", "9": "nine", g: "gee", q: "cue",
}
/** Common non-Latin look-alikes (Cyrillic, Greek) that pass for Latin letters in most fonts. */
const HOMOGLYPHS: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i", ј: "j", ѕ: "s", к: "k", м: "m", н: "h", т: "t", в: "b",
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", І: "I", Ј: "J", Ѕ: "S",
  α: "a", ο: "o", ν: "v", ρ: "p", τ: "t", υ: "u", ι: "i", κ: "k", Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I",
  Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
}
const INVISIBLE: Record<string, string> = {
  "\u00a0": "non-breaking space", "\u200b": "zero-width space", "\u200c": "zero-width non-joiner", "\u200d": "zero-width joiner",
  "\u2060": "word joiner", "\ufeff": "byte-order mark", "\t": "tab", "\u2009": "thin space", "\u202f": "narrow no-break space",
}

export type SpelledChar = {
  char: string
  /** What to say aloud: "K as in Kilo", "lowercase l as in Lima", "the number 0". */
  spoken: string
  /** Short tell-apart name for look-alike characters ("zero", "oh"). */
  caption?: string
  /** Set when the character is not what it looks like: a homoglyph or an invisible character. */
  trap?: "homoglyph" | "invisible"
  /** For a homoglyph, the Latin letter it imitates. For an invisible, its name. */
  trapDetail?: string
}

/** Spells one character for reading aloud. Case is named only when `caseSensitive`. */
export function spellChar(char: string, caseSensitive = false): SpelledChar {
  if (INVISIBLE[char]) return { char, spoken: INVISIBLE[char], trap: "invisible", trapDetail: INVISIBLE[char] }
  if (HOMOGLYPHS[char]) {
    const latin = HOMOGLYPHS[char]
    const script = /[\u0370-\u03ff]/.test(char) ? "Greek" : "Cyrillic"
    return { char, spoken: `${script} ${char} (not Latin ${latin})`, trap: "homoglyph", trapDetail: latin }
  }
  const caption = CONFUSABLE[char]
  if (/[0-9]/.test(char)) return { char, spoken: `the number ${char} (${DIGITS[Number(char)]})`, caption }
  const upper = char.toUpperCase()
  if (NATO[upper] && /[a-z]/i.test(char)) {
    const casing = !caseSensitive ? "" : char === upper ? "capital " : "lowercase "
    return { char, spoken: `${casing}${char} as in ${NATO[upper]}`, caption }
  }
  if (SYMBOLS[char]) return { char, spoken: SYMBOLS[char], caption }
  return { char, spoken: `“${char}” (U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")})` }
}

/** Splits a code into readable groups. A leading "0x" of a hex address stays its own group. */
export function groupCode(value: string, size: number) {
  const chars = Array.from(value)
  const groups: string[][] = []
  let start = 0
  if (/^0x[0-9a-f]+$/i.test(value)) {
    groups.push(chars.slice(0, 2))
    start = 2
  }
  for (let i = start; i < chars.length; i += size) groups.push(chars.slice(i, i + size))
  return groups
}

/** Problems that would make a hand-copied or read-out value fail even when every glyph looks right. */
export function findSpellTraps(value: string) {
  const traps: { kind: "homoglyph" | "invisible" | "edge-space"; position: number; detail: string }[] = []
  Array.from(value).forEach((char, index) => {
    const spelled = spellChar(char)
    if (spelled.trap && spelled.trapDetail) traps.push({ kind: spelled.trap, position: index + 1, detail: spelled.trapDetail })
  })
  if (/^\s|\s$/.test(value)) traps.push({ kind: "edge-space", position: /^\s/.test(value) ? 1 : Array.from(value).length, detail: "space" })
  return traps
}
