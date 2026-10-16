/**
 * hreflang logic for HreflangCheck. Pure functions, safe on the server.
 * Rules follow Google Search Central, "Tell Google about localized versions of
 * your page" (developers.google.com/search/docs/specialty/international/localized-versions):
 * ISO 639-1 language, optional ISO 15924 script, optional ISO 3166-1 alpha-2
 * region; fully-qualified URLs; every version lists itself and every other
 * version; pairs that don't point at each other are ignored.
 */

export type HreflangIssueKind =
  | "bad-code" | "region-code" | "unsupported-code" | "suspect-code" | "relative-url" | "duplicate-code" | "missing-self"
  | "self-near" | "missing-return" | "return-near" | "canonical-other-lang" | "canonical-elsewhere" | "shared-canonical"
  | "missing-x-default" | "no-generic" | "conflict" | "unchecked" | "no-url" | "media" | "ignored-region"

/** Replace text[start, end) with `text`. Inserts have start === end. */
export interface TextEdit {
  start: number
  end: number
  text: string
}

export interface HreflangIssue {
  kind: HreflangIssueKind
  severity: "error" | "warning" | "info"
  /** Index into `pages` of the page the issue belongs to. */
  page: number
  /** Filled into the message: a code, a URL, a count. */
  detail?: string
  /** A second value for the message, e.g. the suggested code. */
  to?: string
  /** Edits that fix it. Undefined: no safe automatic fix. */
  fix?: TextEdit[]
}

export interface HreflangTag {
  rel: "alternate" | "canonical"
  /** hreflang as written (alternate only). */
  hreflang?: string
  href: string
  /** Offsets of the whole tag and of the attribute values in the pasted text. */
  start: number
  end: number
  hrefAt?: [number, number]
  langAt?: [number, number]
  media: boolean
  /** The tag came from an HTTP `Link:` header rather than a <link> element. */
  header?: boolean
}

export interface HreflangPage {
  /** The page's own URL: from a URL line or <loc> above its tags, else its canonical. */
  url?: string
  /** Where `url` came from. */
  urlFrom: "marker" | "canonical" | "prop" | "none"
  tags: HreflangTag[]
  /** Offset to insert new tags after (end of the last tag, or of the marker). */
  insertAt: number
  /** Leading whitespace of the page's tags, reused for inserted ones. */
  indent: string
}

const pairs = (packed: string) => new Set(packed.replace(/\s/g, "").match(/../g) ?? [])
const LANGUAGES = pairs(
  "aaabaeafakamanarasavayazbabebgbibmbnbobrbscacechcocrcscucvcydadedvdzeeeleneoeseteufafffifjfofrfygagdglgngugvhahehihohrhthuhyhziaidieigiiikioisitiujajvkakgkikjkkklkmknkokrkskukvkwkylalblglilnloltlulvmgmhmimkmlmnmrmsmtmynanbndnengnlnnnonrnvnyocojomorospapiplpsptqurmrnrorurwsascsdsesgsisksls" +
    "msnsosqsrssstsusvswtatetgthtitktltntotrtstttwtyugukuruzvevivowawoxhyiyozazhzu",
)
const REGIONS = pairs(
  "adaeafagaialamaoaqarasatauawaxazbabbbdbebfbgbhbibjblbmbnbobqbrbsbtbvbwbybzcacccdcfcgchcickclcmcncocrcucvcwcxcyczdedjdkdmdodzeceeegeheresetfifjfkfmfofrgagbgdgegfggghgiglgmgngpgqgrgsgtgugwgyhkhmhnhrhthuidieiliminioiqirisitjejmjojpkekgkhkikmknkpkrkwkykzlalblclilklrlsltlulvlymamcmdmemfmgmhmkmlmmmnmompmqmrmsmtmumvmwmxmymznancnenfngninlnonpnrnunzompapepfpgphpkplpmpnprpsptpwpyqarerorsrurwsasbscsdsesgshsisjskslsmsnsosrssstsvsxsysztctdtftgthtjtktltmtntotrtttvtwtzuaugumusuyuzvavcvevgvivnvuwfwsyeytzazmzw",
)
/** Country codes written where a language belongs, and retired language codes. */
const LANGUAGE_FIX: Record<string, string> = {
  jp: "ja", cn: "zh", gr: "el", dk: "da", cz: "cs", ua: "uk", rs: "sr", vn: "vi", il: "he", at: "de", us: "en-US", gb: "en-GB", mx: "es-MX",
  iw: "he", in: "id", ji: "yi", jw: "jv", mo: "ro", sh: "sr", english: "en", german: "de", french: "fr", spanish: "es",
}
/** Real language codes that are usually a country by mistake. */
const SUSPECT: Record<string, { means: string; fix?: string }> = {
  uk: { means: "Ukrainian", fix: "en-GB" }, kr: { means: "Kanuri", fix: "ko" }, se: { means: "Northern Sami", fix: "sv" },
  be: { means: "Belarusian" }, br: { means: "Breton", fix: "pt-BR" },
}
/** Regions that aren't ISO 3166-1 country codes, with the right one where there is one. */
const REGION_FIX: Record<string, string | null> = { uk: "GB", en: null, eu: null, un: null }
/** Reserved codes Google names explicitly: it drops the region and keeps the language (Google Search Central, "Incorrect region codes"). */
const IGNORED_REGIONS = new Set(["uk", "eu", "un"])

export interface CodeCheck {
  ok: boolean
  /** Normalised code, e.g. "en-GB". */
  normal?: string
  kind?: "bad-code" | "region-code" | "unsupported-code" | "suspect-code" | "ignored-region"
  /** Suggested replacement. */
  fix?: string
  /** For suspect codes: what the code really means. */
  means?: string
}

/** Validates one hreflang value the way Google reads it. */
export function checkHreflangCode(raw: string): CodeCheck {
  const value = String(raw ?? "").trim()
  if (/^x-default$/i.test(value)) return { ok: true, normal: "x-default" }
  const parts = value.split(/[-_]/)
  const fixed = parts.join("-")
  const [lang = "", ...rest] = parts.map((part) => part.toLowerCase())
  if (!LANGUAGES.has(lang)) {
    const fix = LANGUAGE_FIX[lang] ?? (REGIONS.has(lang) && rest.length === 1 && LANGUAGES.has(rest[0]) ? `${rest[0]}-${lang.toUpperCase()}` : undefined)
    return { ok: false, kind: REGIONS.has(lang) ? "region-code" : "bad-code", fix: fix && rest.length && !fix.includes("-") ? `${fix}-${rest.join("-").toUpperCase()}` : fix }
  }
  let script: string | undefined
  let region: string | undefined
  for (const part of rest) {
    if (/^[a-z]{4}$/.test(part) && !script && !region) script = part[0].toUpperCase() + part.slice(1)
    else if (/^[a-z]{2}$/.test(part) && !region) region = part
    else if (/^\d{3}$/.test(part) && !region) return { ok: false, kind: "unsupported-code", fix: lang }
    else return { ok: false, kind: "bad-code", fix: lang }
  }
  const normal = [lang, script, region?.toUpperCase()].filter(Boolean).join("-")
  if (region && !REGIONS.has(region)) {
    const swap = REGION_FIX[region]
    return { ok: false, kind: IGNORED_REGIONS.has(region) ? "ignored-region" : "bad-code", fix: swap ? [lang, script, swap].filter(Boolean).join("-") : [lang, script].filter(Boolean).join("-") }
  }
  if (fixed !== value) return { ok: false, kind: "bad-code", fix: normal }
  if (!rest.length && SUSPECT[lang]) return { ok: true, normal, kind: "suspect-code", fix: SUSPECT[lang].fix, means: SUSPECT[lang].means }
  return { ok: true, normal }
}

const ATTR = /([A-Za-z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
const MARKER = /^[ \t]*(?:(?:#|\/\/|<!--)[ \t]*)?(?:(?:page|url)[ \t]*:[ \t]*)?(https?:\/\/[^\s<>"']+?)[ \t]*(?:-->)?[ \t]*$/gim
const LOC = /<loc>\s*(?:<!\[CDATA\[\s*)?([^<\s\]]+)\s*(?:\]\]>\s*)?<\/loc>/gi
const TAG = /<(?:xhtml:)?link\b[^>]*>/gi
const COMMENT = /<!--[\s\S]*?-->/g
const LINK_HEADER = /^[ \t]*link[ \t]*:(.*)$/gim
const LINK_ENTRY = /<([^>]*)>((?:\s*;\s*[^,;]*)*)/g
const LINK_PARAM = /;\s*([\w-]+)\s*=\s*(?:"([^"]*)"|([^\s;,"]+))/g
/** XML/HTML attribute text to the URL it stands for (&amp; → &). */
const decode = (text: string) => text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" })[name] ?? "")

/** Splits the pasted text into pages, each with its alternate and canonical tags. Handles CRLF and a BOM. */
export function parseHreflang(text: string, pageUrl?: string): HreflangPage[] {
  const source = String(text ?? "")
  type Marker = { at: number; end: number; url: string }
  const markers: Marker[] = []
  for (const match of source.matchAll(MARKER)) markers.push({ at: match.index ?? 0, end: (match.index ?? 0) + match[0].length, url: match[1] })
  for (const match of source.matchAll(LOC)) markers.push({ at: match.index ?? 0, end: (match.index ?? 0) + match[0].length, url: match[1] })
  markers.sort((a, b) => a.at - b.at)

  // Commented-out tags (and URL lines inside <!-- --> that aren't markers) are not live.
  const comments = [...source.matchAll(COMMENT)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length])
  const commented = (at: number) => comments.some(([from, to]) => at > from && at < to)
  for (let i = markers.length - 1; i >= 0; i--) if (commented(markers[i].at) && !/^\s*<!--\s*(?:(?:page|url)\s*:\s*)?https?:\/\/\S+?\s*-->\s*$/i.test(source.slice(markers[i].at, markers[i].end))) markers.splice(i, 1)
  for (const marker of markers) marker.url = decode(marker.url)

  const tags: HreflangTag[] = []
  // HTTP Link header: Link: <url>; rel="alternate"; hreflang="de", <url2>; ...
  for (const line of source.matchAll(LINK_HEADER)) {
    const valueAt = (line.index ?? 0) + line[0].length - line[1].length
    const entries = [...line[1].matchAll(LINK_ENTRY)]
    entries.forEach((entry, n) => {
      const at = valueAt + (entry.index ?? 0)
      const params = new Map<string, { value: string; at: [number, number] }>()
      for (const param of entry[2].matchAll(LINK_PARAM)) {
        const value = param[2] ?? param[3] ?? ""
        const offset = at + 1 + entry[1].length + 1 + (param.index ?? 0) + param[0].length - value.length - (param[2] === undefined ? 0 : 1)
        params.set(param[1].toLowerCase(), { value, at: [offset, offset + value.length] })
      }
      const rel = (params.get("rel")?.value ?? "").toLowerCase().split(/\s+/)
      const kind = rel.includes("canonical") ? "canonical" : rel.includes("alternate") && params.has("hreflang") ? "alternate" : null
      if (!kind) return
      // Removing an entry takes its separating comma with it.
      const before = n > 0 ? source.lastIndexOf(",", at) : at
      const after = n === 0 && entries.length > 1 ? valueAt + (entries[1].index ?? 0) : at + entry[0].length
      tags.push({ rel: kind, hreflang: kind === "alternate" ? params.get("hreflang")?.value : undefined, href: decode(entry[1].trim()), start: before, end: after, hrefAt: [at + 1, at + 1 + entry[1].length], langAt: params.get("hreflang")?.at, media: params.has("media"), header: true })
    })
  }
  for (const match of source.matchAll(TAG)) {
    const start = match.index ?? 0
    if (commented(start)) continue
    const attrs = new Map<string, { value: string; at: [number, number] }>()
    for (const attr of match[0].matchAll(ATTR)) {
      const value = attr[2] ?? attr[3] ?? attr[4] ?? ""
      const offset = start + (attr.index ?? 0) + attr[0].length - value.length - (attr[4] === undefined ? 1 : 0)
      attrs.set(attr[1].toLowerCase(), { value, at: [offset, offset + value.length] })
    }
    const rel = (attrs.get("rel")?.value ?? "").toLowerCase().split(/\s+/)
    const href = attrs.get("href")
    if (!href) continue
    const kind = rel.includes("canonical") ? "canonical" : rel.includes("alternate") && attrs.has("hreflang") ? "alternate" : null
    if (!kind) continue
    const lang = attrs.get("hreflang")
    tags.push({ rel: kind, hreflang: kind === "alternate" ? lang?.value : undefined, href: decode(href.value.trim()), start, end: start + match[0].length, hrefAt: href.at, langAt: lang?.at, media: attrs.has("media") })
  }

  tags.sort((a, b) => a.start - b.start)
  const pages: HreflangPage[] = []
  const open = (url: string | undefined, urlFrom: HreflangPage["urlFrom"], insertAt: number) => pages.push({ url, urlFrom, tags: [], insertAt, indent: "" })
  let next = 0
  for (const tag of tags) {
    while (next < markers.length && markers[next].at < tag.start) {
      open(markers[next].url, "marker", markers[next].end)
      next++
    }
    let page = pages.at(-1)
    // Without URL lines, a second canonical starts the next page.
    if (!page || (page.urlFrom !== "marker" && tag.rel === "canonical" && page.tags.some((t) => t.rel === "canonical"))) {
      open(undefined, "none", tag.start)
      page = pages.at(-1) as HreflangPage
    }
    page.tags.push(tag)
    page.insertAt = tag.end
    if (page.tags.length === 1) page.indent = /[ \t]*$/.exec(source.slice(0, tag.start).split(/\r\n|\r|\n/).at(-1) ?? "")?.[0] ?? ""
  }
  for (const page of pages) {
    if (page.url) continue
    const canonical = page.tags.find((t) => t.rel === "canonical" && /^https?:\/\//i.test(t.href))
    if (canonical) Object.assign(page, { url: canonical.href, urlFrom: "canonical" })
    else if (pages.length === 1 && typeof pageUrl === "string" && pageUrl.trim()) Object.assign(page, { url: pageUrl.trim(), urlFrom: "prop" })
  }
  return pages.filter((page) => page.tags.length || page.urlFrom === "marker")
}

const absolute = (href: string) => /^https?:\/\//i.test(href)
/** Resolves a href against a page URL; undefined when it can't. */
function resolve(href: string, base: string | undefined) {
  try {
    return new URL(href, base).href
  } catch {
    return undefined
  }
}
/** Same URL apart from a trailing slash, http/https, www. or host case. Google still treats them as different URLs. */
function near(a: string | undefined, b: string | undefined) {
  if (!a || !b || a === b) return false
  const key = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/^[^/]+/, (host) => host.toLowerCase()).replace(/\/(?=$|[?#])/, "")
  return key(a) === key(b)
}
const altTag = (code: string, href: string, xhtml: boolean) => (xhtml ? `<xhtml:link rel="alternate" hreflang="${code}" href="${href}"/>` : `<link rel="alternate" hreflang="${code}" href="${href}" />`)

/** Every problem across every pasted page, worst first. */
export function checkHreflang(text: string, pageUrl?: string): { pages: HreflangPage[]; issues: HreflangIssue[] } {
  const source = String(text ?? "")
  const pages = parseHreflang(source, pageUrl)
  const issues: HreflangIssue[] = []
  const eol = /\r\n/.test(source) ? "\r\n" : "\n"
  const xhtml = /<xhtml:link/i.test(source)
  /** URLs written back into XML (or next to &amp; already in the paste) must be escaped. */
  const escapeAmp = xhtml || /&amp;/i.test(source)
  const enc = (url: string) => (escapeAmp ? url.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+);)/g, "&amp;") : url)
  const altFor = (page: HreflangPage, code: string, href: string) =>
    page.tags.at(-1)?.header ? `, <${href}>; rel="alternate"; hreflang="${code}"` : altTag(code, enc(href), xhtml)
  const insert = (page: HreflangPage, tag: string): TextEdit => ({ start: page.insertAt, end: page.insertAt, text: tag.startsWith(", <") ? tag : eol + page.indent + tag })
  const swapUrl = (tag: HreflangTag, url: string): TextEdit[] => (tag.hrefAt ? [{ start: tag.hrefAt[0], end: tag.hrefAt[1], text: tag.header ? url : enc(url) }] : [])
  const base = (page: HreflangPage) => page.url ?? page.tags.map((t) => t.href).find(absolute)
  const alternates = (page: HreflangPage) => page.tags.filter((t) => t.rel === "alternate")
  const hrefOf = (page: HreflangPage, tag: HreflangTag) => (absolute(tag.href) ? tag.href : resolve(tag.href, base(page)))
  const pageAt = (url: string | undefined) => (url ? pages.findIndex((p) => p.url === url) : -1)

  /** The code a page is for: its self-reference, else what other pages call it, else a /de/ or de. in its URL. */
  const codeOf = (index: number) => {
    const page = pages[index]
    const self = alternates(page).find((t) => hrefOf(page, t) === page.url && !/^x-default$/i.test(t.hreflang ?? ""))
    if (self) return checkHreflangCode(self.hreflang ?? "").normal ?? self.hreflang
    for (const other of pages) {
      const named = alternates(other).find((t) => hrefOf(other, t) === page.url && !/^x-default$/i.test(t.hreflang ?? ""))
      if (named) return checkHreflangCode(named.hreflang ?? "").normal ?? named.hreflang
    }
    const hint = /^https?:\/\/([a-z]{2}(?:-[a-z]{2})?)\.|\/([a-z]{2}(?:[-_][a-z]{2})?)(?=\/|$)/i.exec(page.url ?? "")
    const guess = hint ? checkHreflangCode(hint[1] ?? hint[2]) : undefined
    return guess?.ok ? guess.normal : undefined
  }

  const seen = new Map<string, { url: string; page: number }>()
  pages.forEach((page, index) => {
    const push = (kind: HreflangIssueKind, severity: HreflangIssue["severity"], detail?: string, fix?: TextEdit[], to?: string) => issues.push({ kind, severity, page: index, detail, to, fix })
    const alts = alternates(page)
    if (!page.url && alts.length) push("no-url", "info")
    const codes = new Map<string, string>()
    for (const tag of alts) {
      const code = checkHreflangCode(tag.hreflang ?? "")
      const replace = (to: string) => (tag.langAt ? [{ start: tag.langAt[0], end: tag.langAt[1], text: to }] : undefined)
      if (!code.ok) push(code.kind ?? "bad-code", "error", tag.hreflang ?? "", code.fix ? replace(code.fix) : undefined, code.fix)
      else if (code.kind === "suspect-code") push("suspect-code", "info", tag.hreflang, code.fix ? replace(code.fix) : undefined, code.means)
      if (tag.media) push("media", "warning", tag.hreflang)
      const resolved = hrefOf(page, tag)
      if (!absolute(tag.href)) push("relative-url", "error", tag.href, resolved && tag.hrefAt ? swapUrl(tag, resolved) : undefined)
      const key = code.normal ?? (tag.hreflang ?? "").toLowerCase()
      if (resolved && codes.has(key) && codes.get(key) !== resolved) push("duplicate-code", "error", tag.hreflang, [{ start: tag.start, end: tag.end, text: "" }])
      if (resolved && !codes.has(key)) codes.set(key, resolved)
      if (resolved && code.ok) {
        const prior = seen.get(key)
        if (prior && prior.page !== index && prior.url !== resolved && !near(prior.url, resolved)) push("conflict", "warning", key, undefined, prior.url)
        if (!prior) seen.set(key, { url: resolved, page: index })
      }
    }
    if (!alts.length) return

    const selfCode = codeOf(index)
    if (page.url && !alts.some((t) => hrefOf(page, t) === page.url)) {
      const close = alts.find((t) => near(hrefOf(page, t), page.url))
      if (close?.hrefAt) push("self-near", "error", close.href, swapUrl(close, page.url), page.url)
      else push("missing-self", "error", page.url, selfCode ? [insert(page, altFor(page, selfCode, page.url))] : undefined, selfCode)
    }

    const canonical = page.tags.find((t) => t.rel === "canonical")
    const canonicalUrl = canonical ? hrefOf(page, canonical) : undefined
    if (canonical?.hrefAt && page.url && page.urlFrom !== "canonical" && canonicalUrl !== page.url) {
      const fix = swapUrl(canonical, page.url)
      // The canonical's language: from this page's tags, or from what any pasted page calls that URL.
      const named = pages.flatMap((p) => alternates(p).filter((t) => hrefOf(p, t) === canonicalUrl && !/^x-default$/i.test(t.hreflang ?? "")))[0]
      const otherCode = named ? (checkHreflangCode(named.hreflang ?? "").normal ?? named.hreflang) : undefined
      if (otherCode && otherCode !== selfCode) push("canonical-other-lang", "error", otherCode, fix, canonicalUrl)
      else push("canonical-elsewhere", near(canonicalUrl, page.url) ? "error" : "warning", canonicalUrl, fix)
    }
    if (page.urlFrom === "canonical" && pages.some((p, i) => i < index && p.url === page.url)) push("shared-canonical", "error", page.url)

    if (!alts.some((t) => /^x-default$/i.test(t.hreflang ?? ""))) {
      const generic = alts.find((t) => /^[a-z]{2}$/i.test(t.hreflang ?? "") && (t.hreflang ?? "").toLowerCase() === "en") ?? alts.find((t) => /^[a-z]{2}$/i.test(t.hreflang ?? "")) ?? alts[0]
      const target = hrefOf(page, generic)
      push("missing-x-default", "warning", target, target ? [insert(page, altFor(page, "x-default", target))] : undefined)
    }
    const langs = new Set([...codes.keys()].filter((c) => /^[a-z]{2,3}$/.test(c)))
    const regional = [...new Set([...codes.keys()].filter((c) => /-[A-Z]{2}$/.test(c)).map((c) => c.split("-")[0]))].filter((lang) => !langs.has(lang))
    if (regional.length) push("no-generic", "info", regional.join(", "))

    // Return links: every page this one names must name it back.
    let unchecked = 0
    for (const tag of alts) {
      const target = hrefOf(page, tag)
      if (!target || target === page.url || !page.url) continue
      const other = pageAt(target)
      if (other < 0) {
        if (!pages.some((p) => near(p.url, target))) unchecked++
        continue
      }
      const back = pages[other]
      const otherAlts = alternates(back)
      if (otherAlts.some((t) => hrefOf(back, t) === page.url)) continue
      if (issues.some((i) => i.page === other && (i.kind === "missing-return" || i.kind === "return-near") && i.detail === page.url)) continue
      const close = otherAlts.find((t) => near(hrefOf(back, t), page.url))
      const own = { severity: "error" as const, page: other, detail: page.url }
      if (close?.hrefAt) issues.push({ ...own, kind: "return-near" as const, to: close.href, fix: swapUrl(close, page.url) })
      else issues.push({ ...own, kind: "missing-return" as const, to: selfCode, fix: selfCode && otherAlts.length ? [insert(back, altFor(back, selfCode, page.url))] : undefined })
    }
    if (unchecked) push("unchecked", "info", String(unchecked))
  })
  const rank = { error: 0, warning: 1, info: 2 }
  return { pages, issues: issues.sort((a, b) => rank[a.severity] - rank[b.severity] || a.page - b.page) }
}

/** Applies edits (offsets into the original text), latest first so earlier offsets stay valid. */
export function applyHreflangEdits(text: string, edits: TextEdit[]) {
  return [...edits].sort((a, b) => b.start - a.start).reduce((out, edit) => out.slice(0, edit.start) + edit.text + out.slice(edit.end), String(text ?? ""))
}

/** Who links to whom: for each pasted page with a URL, whether it lists every other one (and itself). */
export function returnMatrix(pages: HreflangPage[]) {
  const known = pages.filter((p) => p.url)
  return known.map((row) => {
    const hrefs = row.tags.filter((t) => t.rel === "alternate").map((t) => (absolute(t.href) ? t.href : resolve(t.href, row.url)))
    return { url: row.url as string, cells: known.map((col) => (hrefs.includes(col.url) ? "yes" : hrefs.some((h) => near(h, col.url)) ? "near" : "no") as "yes" | "near" | "no") }
  })
}
