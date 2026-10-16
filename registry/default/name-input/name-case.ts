/** Name particles that stay lower case between other words: Maria de la Cruz, Anna van der Berg. */
const PARTICLES = new Set(["van", "von", "der", "den", "de", "del", "della", "di", "da", "das", "dos", "du", "la", "le", "ten", "ter", "bin", "bint", "ibn", "al", "el", "zu"])
/** "Mac" names that take a second capital. Others (Mack, Macon, Machado) don't, so this is a list, not a rule. */
const MAC = new Set(["macdonald", "macarthur", "macgregor", "mackenzie", "macleod", "macmillan", "macintyre", "macneil", "maclean", "macpherson", "macaulay", "macinnes", "macdougall", "mackinnon", "macfarlane", "maclachlan", "macrae", "mackay"])
const SUFFIXES = new Set(["ii", "iii", "iv"])

/** Common family names that are rarely given names, used only to spot a swapped first/last. */
const SURNAMES = new Set([
  "sharma", "patel", "singh", "kaur", "kumar", "gupta", "khan", "reddy", "rao", "das", "shah", "mehta", "iyer", "nair", "joshi",
  "kulkarni", "deshpande", "verma", "agarwal", "banerjee", "chatterjee", "mukherjee", "pillai", "menon", "chopra", "kapoor",
  "malhotra", "bhat", "jain", "yadav", "pandey", "mishra", "patil", "pawar", "jadhav", "shinde",
  "smith", "johnson", "williams", "brown", "jones", "garcia", "miller", "davis", "rodriguez", "martinez", "hernandez",
  "lopez", "gonzalez", "wilson", "anderson", "taylor", "nguyen", "wang", "zhang", "chen", "müller", "schmidt", "schneider",
])
/** Common given names, the other half of the swap signal. */
const GIVEN = new Set([
  "priya", "rahul", "amit", "anita", "sunita", "rohan", "neha", "pooja", "arjun", "aditya", "ananya", "vikram", "sanjay",
  "deepak", "kavya", "aisha", "fatima", "mohammed", "ravi", "suresh", "ramesh", "meera", "tushar", "isha", "karan", "sneha",
  "john", "mary", "james", "maria", "anna", "david", "sarah", "michael", "emma", "olivia", "liam", "noah", "sofia", "wei", "sean", "patrick",
])

const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Cases one word: McDonald, MacGregor (listed only), O'Brien, D'Angelo, Jean-Pierre. */
function caseWord(word: string): string {
  const low = word.toLowerCase()
  if (low.includes("-")) return low.split("-").map(caseWord).join("-")
  const apostrophe = /^(\p{L})(['’])(\p{L}.*)$/u.exec(low)
  if (apostrophe) return apostrophe[1].toUpperCase() + apostrophe[2] + cap(apostrophe[3])
  if (/^mc\p{L}{2,}/u.test(low)) return "Mc" + cap(low.slice(2))
  if (MAC.has(low)) return "Mac" + cap(low.slice(3))
  return cap(low)
}

const letters = (word: string) => word.replace(/[^\p{L}]/gu, "")
const isUpper = (word: string) => letters(word).length > 0 && word === word.toUpperCase() && word !== word.toLowerCase()
const isLower = (word: string) => letters(word).length > 0 && word === word.toLowerCase() && word !== word.toUpperCase()

/**
 * Re-cases a name typed in all caps or all lower case, word by word. Words the
 * person already mixed-cased (DeShawn, Macdonald) are left exactly as typed.
 * Short all-caps words inside an otherwise normal name (PJ, AJ) are treated as initials.
 */
export function smartCaseName(name: string, { surname = false }: { surname?: boolean } = {}): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const shouting = words.every((w) => isUpper(w) || !letters(w))
  return words
    .map((word, i) => {
      const low = word.toLowerCase()
      if (!isLower(word) && !isUpper(word)) return word
      if (isUpper(word) && !shouting && letters(word).length <= 2) return word
      if (i > 0 && SUFFIXES.has(low)) return low.toUpperCase()
      // A leading particle stays lower case in a surname-only field ("van der Berg"), and is capitalised in a full name.
      if ((i > 0 || surname) && i < words.length - 1 && PARTICLES.has(low)) return low
      return caseWord(word)
    })
    .join(" ")
}

export interface NameIssue {
  kind: "digits" | "case" | "spaces"
  /** The cleaned-up name to offer, when one can be made safely. */
  fix?: string
  /** "caps" or "lower" for case issues; the stray digits for digit issues. */
  detail?: string
}

/** Finds the most important slip in a name, or null when it looks fine. Never changes the input. */
export function findNameIssue(name: string, options?: { surname?: boolean }): NameIssue | null {
  if (!name.trim()) return null
  const words = name.trim().split(/\s+/)
  const digits = name.match(/\d/g)
  // Digits stuck to the edge of a word (Sharma2) are safe to drop; inside a word (J0hn) they're left to the user.
  const stripped = words.map((w) => w.replace(/^\d+|\d+$/g, "")).filter(Boolean).join(" ")
  const cased = smartCaseName(stripped, options)
  if (digits) return { kind: "digits", detail: digits.join(""), fix: /\d/.test(stripped) ? undefined : cased }
  if (cased !== words.join(" ")) return { kind: "case", fix: cased, detail: words.every(isUpper) || isUpper(words[0]) ? "caps" : "lower" }
  if (/\s{2,}/.test(name.trim()) || /^\s/.test(name)) return { kind: "spaces", fix: cased }
  return null
}

/**
 * True when the given and family names look entered the wrong way round:
 * "Sharma," / "Priya", a particle-led surname in the first field, or a common
 * surname first and a common given name last.
 */
export function looksSwapped(first: string, last: string): boolean {
  const f = first.trim().toLowerCase()
  const l = last.trim().toLowerCase()
  if (!f || !l) return false
  if (/,$/.test(f)) return true
  const firstWord = f.split(/\s+/)[0]
  if (f.includes(" ") && PARTICLES.has(firstWord) && !PARTICLES.has(l.split(/\s+/)[0])) return true
  // McKenzie and O'Neal are given names too, so a Mc/O' first field needs a known given name beside it.
  if (/^(mc|o['’])\p{L}/u.test(f) && GIVEN.has(l)) return true
  // Only when both sides agree: a known surname first AND a known given name last. Plenty of
  // surnames are also first names (Taylor Swift, Kumar Sanu), so a surname alone proves nothing.
  return SURNAMES.has(f) && GIVEN.has(l) && !GIVEN.has(f) && !SURNAMES.has(l)
}
