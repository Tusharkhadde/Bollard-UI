/**
 * Look-alike character detection for usernames, handles and domains, following the ideas in
 * Unicode UTS #39 (confusables, mixed-script and whole-script confusable detection) and the
 * IDN display policy browsers use to decide when to show punycode.
 */

/** Cross-script characters NFKC does not fold, with the Latin letter they imitate and their Unicode name. */
const CONFUSABLES: Record<string, [string, string]> = {
  а: ["a", "CYRILLIC SMALL LETTER A"], е: ["e", "CYRILLIC SMALL LETTER IE"], о: ["o", "CYRILLIC SMALL LETTER O"],
  р: ["p", "CYRILLIC SMALL LETTER ER"], с: ["c", "CYRILLIC SMALL LETTER ES"], у: ["y", "CYRILLIC SMALL LETTER U"],
  х: ["x", "CYRILLIC SMALL LETTER HA"], ѕ: ["s", "CYRILLIC SMALL LETTER DZE"], і: ["i", "CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I"],
  ј: ["j", "CYRILLIC SMALL LETTER JE"], ԁ: ["d", "CYRILLIC SMALL LETTER KOMI DE"], һ: ["h", "CYRILLIC SMALL LETTER SHHA"],
  ӏ: ["l", "CYRILLIC SMALL LETTER PALOCHKA"], ԛ: ["q", "CYRILLIC SMALL LETTER QA"], ԝ: ["w", "CYRILLIC SMALL LETTER WE"],
  А: ["A", "CYRILLIC CAPITAL LETTER A"], В: ["B", "CYRILLIC CAPITAL LETTER VE"], Е: ["E", "CYRILLIC CAPITAL LETTER IE"],
  К: ["K", "CYRILLIC CAPITAL LETTER KA"], М: ["M", "CYRILLIC CAPITAL LETTER EM"], Н: ["H", "CYRILLIC CAPITAL LETTER EN"],
  О: ["O", "CYRILLIC CAPITAL LETTER O"], Р: ["P", "CYRILLIC CAPITAL LETTER ER"], С: ["C", "CYRILLIC CAPITAL LETTER ES"],
  Т: ["T", "CYRILLIC CAPITAL LETTER TE"], Х: ["X", "CYRILLIC CAPITAL LETTER HA"], У: ["Y", "CYRILLIC CAPITAL LETTER U"],
  Ѕ: ["S", "CYRILLIC CAPITAL LETTER DZE"], І: ["I", "CYRILLIC CAPITAL LETTER BYELORUSSIAN-UKRAINIAN I"], Ј: ["J", "CYRILLIC CAPITAL LETTER JE"],
  ο: ["o", "GREEK SMALL LETTER OMICRON"], α: ["a", "GREEK SMALL LETTER ALPHA"], ν: ["v", "GREEK SMALL LETTER NU"],
  ρ: ["p", "GREEK SMALL LETTER RHO"], ι: ["i", "GREEK SMALL LETTER IOTA"], κ: ["k", "GREEK SMALL LETTER KAPPA"],
  υ: ["u", "GREEK SMALL LETTER UPSILON"], χ: ["x", "GREEK SMALL LETTER CHI"],
  Α: ["A", "GREEK CAPITAL LETTER ALPHA"], Β: ["B", "GREEK CAPITAL LETTER BETA"], Ε: ["E", "GREEK CAPITAL LETTER EPSILON"],
  Ζ: ["Z", "GREEK CAPITAL LETTER ZETA"], Η: ["H", "GREEK CAPITAL LETTER ETA"], Ι: ["I", "GREEK CAPITAL LETTER IOTA"],
  Κ: ["K", "GREEK CAPITAL LETTER KAPPA"], Μ: ["M", "GREEK CAPITAL LETTER MU"], Ν: ["N", "GREEK CAPITAL LETTER NU"],
  Ο: ["O", "GREEK CAPITAL LETTER OMICRON"], Ρ: ["P", "GREEK CAPITAL LETTER RHO"], Τ: ["T", "GREEK CAPITAL LETTER TAU"],
  Υ: ["Y", "GREEK CAPITAL LETTER UPSILON"], Χ: ["X", "GREEK CAPITAL LETTER CHI"],
  օ: ["o", "ARMENIAN SMALL LETTER OH"], ս: ["u", "ARMENIAN SMALL LETTER SEH"], հ: ["h", "ARMENIAN SMALL LETTER HO"],
  ո: ["n", "ARMENIAN SMALL LETTER VO"], ı: ["i", "LATIN SMALL LETTER DOTLESS I"], ɑ: ["a", "LATIN SMALL LETTER ALPHA"],
  ɡ: ["g", "LATIN SMALL LETTER SCRIPT G"],
}

const INVISIBLE_NAMES: Record<number, string> = {
  0x00ad: "SOFT HYPHEN", 0x034f: "COMBINING GRAPHEME JOINER", 0x180e: "MONGOLIAN VOWEL SEPARATOR",
  0x200b: "ZERO WIDTH SPACE", 0x200c: "ZERO WIDTH NON-JOINER", 0x200d: "ZERO WIDTH JOINER",
  0x200e: "LEFT-TO-RIGHT MARK", 0x200f: "RIGHT-TO-LEFT MARK", 0x202a: "LEFT-TO-RIGHT EMBEDDING",
  0x202b: "RIGHT-TO-LEFT EMBEDDING", 0x202c: "POP DIRECTIONAL FORMATTING", 0x202d: "LEFT-TO-RIGHT OVERRIDE",
  0x202e: "RIGHT-TO-LEFT OVERRIDE", 0x2060: "WORD JOINER", 0x2066: "LEFT-TO-RIGHT ISOLATE",
  0x2067: "RIGHT-TO-LEFT ISOLATE", 0x2068: "FIRST STRONG ISOLATE", 0x2069: "POP DIRECTIONAL ISOLATE",
  0xfeff: "ZERO WIDTH NO-BREAK SPACE",
}

/** Scripts whose letters overlap Latin's shapes; mixing them with Latin (or each other) is the classic spoof. */
const LOOKALIKE_SCRIPTS = ["Cyrillic", "Greek", "Armenian", "Cherokee"]
const SCRIPTS = ["Latin", ...LOOKALIKE_SCRIPTS, "Georgian", "Hebrew", "Arabic", "Devanagari", "Bengali", "Tamil", "Thai", "Han", "Hiragana", "Katakana", "Hangul"]
const scriptTests = SCRIPTS.map((name) => [name, new RegExp(`^\\p{Script=${name}}$`, "u")] as const)
const neutral = /^[\p{Script=Common}\p{Script=Inherited}]$/u
const invisible = /^[\p{Default_Ignorable_Code_Point}\p{Cf}]$/u
const oddSpace = /^[\p{Zs}]$/u

export type HomoglyphKind = "lookalike" | "invisible" | "styled" | "ambiguous"

export interface HomoglyphFinding {
  /** Position in the value, counted in code points (Array.from(value)). */
  index: number
  char: string
  /** "U+0430" */
  codePoint: string
  /** Unicode script, or "Common" for digits, punctuation and invisibles. */
  script: string
  /** Unicode character name, or a readable description. */
  name: string
  /** The plain character it imitates ("" for invisibles). */
  looksLike: string
  kind: HomoglyphKind
}

export interface HomoglyphReport {
  findings: HomoglyphFinding[]
  /** Scripts used by letters in the value. */
  scripts: string[]
  /** True when a part of the value mixes Latin with Cyrillic, Greek, Armenian or Cherokee. */
  mixedScript: boolean
  /** The plain-ASCII version, when a look-alike, styled or invisible character was found and every letter maps to ASCII. */
  ascii: string | null
  /** A protected name the value imitates without being it ("paypa1" → "paypal"). */
  impersonates: string | null
}

const scriptOf = (ch: string) => (neutral.test(ch) ? "Common" : scriptTests.find(([, re]) => re.test(ch))?.[0] ?? "Other")
const hex = (ch: string) => "U+" + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")
const stripMarks = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "")
const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s)

/** UTS #39-style skeleton, extended with the ASCII look-alikes (0/O, 1/l/I, rn/m, vv/w). Only for comparing. */
export function skeleton(value: string) {
  const plain = Array.from(value.normalize("NFKC"), (ch) => (invisible.test(ch) ? "" : CONFUSABLES[ch]?.[0] ?? ch)).join("")
  return stripMarks(plain).toLowerCase().replace(/0/g, "o").replace(/[1i|]/g, "l").replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d")
}

/**
 * Finds the characters in a username, handle or domain that pretend to be something else:
 * Cyrillic/Greek look-alikes in a Latin name (or a name written wholly in look-alikes, like "ѕсоре"),
 * zero-width and bidi-control characters, fullwidth or styled letters, and ambiguous ASCII (0/O, 1/l/I).
 * A name written legitimately in one non-Latin script ("иван") is left alone.
 */
export function detectHomoglyphs(value: string, protectedNames: string[] = []): HomoglyphReport {
  const chars = Array.from(value)
  const findings: HomoglyphFinding[] = []
  const scripts = new Set<string>()
  let mixedScript = false
  let start = 0

  // Judge each label (between . @ / and spaces) on its own, as browsers do for domains.
  for (const label of value.split(/[.@/\s]/)) {
    const part = Array.from(label)
    const letterScripts = new Set(part.map(scriptOf).filter((s) => s !== "Common"))
    letterScripts.forEach((s) => scripts.add(s))
    const risky = [...letterScripts].filter((s) => LOOKALIKE_SCRIPTS.includes(s))
    const mixed = risky.length > 0 && letterScripts.size > 1
    const letters = part.filter((ch) => /\p{L}/u.test(ch))
    const wholeConfusable = letterScripts.size === 1 && risky.length === 1 && letters.every((ch) => CONFUSABLES[ch])
    mixedScript ||= mixed
    // In a mixed label the impostors are the minority script's letters.
    const counts = [...letterScripts].map((s) => [s, part.filter((ch) => scriptOf(ch) === s).length] as const)
    const majority = counts.sort((a, b) => b[1] - a[1] || (a[0] === "Latin" ? -1 : 1))[0]?.[0]

    part.forEach((ch, i) => {
      const index = start + i
      const script = scriptOf(ch)
      const base = { index, char: ch, codePoint: hex(ch), script }
      const folded = ch.normalize("NFKC")
      if (invisible.test(ch) || (oddSpace.test(ch) && ch !== " ")) {
        findings.push({ ...base, name: INVISIBLE_NAMES[ch.codePointAt(0)!] ?? "INVISIBLE OR SPACING CHARACTER", looksLike: "", kind: "invisible" })
      } else if (CONFUSABLES[ch] && (wholeConfusable || (mixed && script !== majority))) {
        findings.push({ ...base, name: CONFUSABLES[ch][1], looksLike: CONFUSABLES[ch][0], kind: "lookalike" })
      } else if (mixed && script !== majority && script !== "Common") {
        // e.g. a Latin "o" slipped into a Cyrillic word: it imitates the majority script's letter.
        const imitated = Object.keys(CONFUSABLES).find((k) => CONFUSABLES[k][0] === ch && scriptOf(k) === majority)
        const name = /^[a-z]$/i.test(ch) ? `LATIN ${ch === ch.toUpperCase() ? "CAPITAL" : "SMALL"} LETTER ${ch.toUpperCase()}` : `${script.toUpperCase()} LETTER`
        findings.push({ ...base, name, looksLike: imitated ?? stripMarks(ch), kind: "lookalike" })
      } else if (folded !== ch && isAscii(folded)) {
        findings.push({ ...base, name: "STYLED OR FULLWIDTH FORM", looksLike: folded, kind: "styled" })
      } else if (/[01]/.test(ch) && /[a-z]/i.test(label)) {
        // A run of 0/1 touching letters and no other digits reads as letters: g00gle, paypa1.
        const run = /[01]+/g
        let m: RegExpExecArray | null
        while ((m = run.exec(label))) {
          if (i < m.index || i >= m.index + m[0].length) continue
          const before = label[m.index - 1] ?? ""
          const after = label[m.index + m[0].length] ?? ""
          if (!/\d/.test(before + after) && /[a-z]/i.test(before + after)) {
            findings.push({ ...base, name: ch === "0" ? "DIGIT ZERO" : "DIGIT ONE", looksLike: ch === "0" ? "O" : "l", kind: "ambiguous" })
          }
        }
      } else if ((ch === "I" && /[a-z]/.test(label)) || (ch === "l" && /[I1|]/.test(label))) {
        findings.push({ ...base, name: ch === "I" ? "LATIN CAPITAL LETTER I" : "LATIN SMALL LETTER L", looksLike: ch === "I" ? "l" : "I", kind: "ambiguous" })
      }
    })
    start += part.length + 1
  }

  const serious = findings.some((f) => f.kind !== "ambiguous")
  const plain = stripMarks(chars.map((ch, i) => {
    const f = findings.find((x) => x.index === i && x.kind !== "ambiguous")
    return f ? f.looksLike : ch
  }).join(""))
  const ascii = serious && isAscii(plain) && plain !== value ? plain : null

  // Chrome's last IDN rule: a name whose skeleton matches a protected name, but isn't it, is an impersonation.
  const parts = [value, ...value.split(/[.@/]/)]
  const impersonates = protectedNames.find((name) => parts.some((part) =>
    skeleton(part) === skeleton(name) && part.normalize("NFKC").toLowerCase() !== name.toLowerCase(),
  )) ?? null

  return { findings, scripts: [...scripts], mixedScript, ascii, impersonates }
}
