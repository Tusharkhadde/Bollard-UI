// Bollard UI — stale-attachment-check · MIT licence · https://bollard-ui.vercel.app/components/stale-attachment-check

/** A file, attached or sitting nearby (same folder, drive or recent files). */
export interface StaleFile {
  id: string
  name: string
  /** Last modified: a Date, epoch ms or an ISO string. Unreadable values are ignored, never thrown on. */
  modified?: Date | number | string | null
}

/** One reason an attachment may be the wrong copy. */
export type StaleIssue =
  | { kind: "changedSince"; replacement: StaleFile }
  | { kind: "newer"; replacement: StaleFile; by: "time" | "version" }
  | { kind: "lockFile" }
  | { kind: "nameHint"; word: string }
  | { kind: "beforeSubject"; source: "name" | "modified"; fileDate: number; subjectDate: number; period: "day" | "month" }

const DAY = 86_400_000
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const HINT_WORDS = ["draft", "old", "copy", "backup", "bak", "tmp", "temp", "wip", "outdated", "superseded", "obsolete", "archived", "deprecated", "unused"]
/** Words that say nothing about which document it is, so "report_final" and "report_v3" compare equal. */
const NOISE = new Set([...HINT_WORDS, "final", "latest", "new", "updated", "revised", "edited", "of", "clean", "v", "ver", "version", "rev"])
const OFFICE = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "pages", "numbers", "key", "odt", "ods", "odp"])

/** Epoch ms, or null for anything unreadable. */
export function toTime(value: StaleFile["modified"]): number | null {
  if (value === null || value === undefined || value === "") return null
  const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(String(value))
  return Number.isFinite(time) ? time : null
}

function split(name: string) {
  const clean = String(name ?? "").trim()
  const dot = clean.lastIndexOf(".")
  const hasExt = dot > 0 && clean.length - dot <= 6
  return { stem: hasExt ? clean.slice(0, dot) : clean, ext: hasExt ? clean.slice(dot + 1).toLowerCase() : "" }
}

const VERSION = /(?:^|[^a-z])(?:v|ver|version|rev)[\s._-]?(\d+(?:\.\d+)?)(?![a-z\d])/i
const ISO_DATE = /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)/
const DMY_DATE = /(?<!\d)(0[1-9]|[12]\d|3[01])[-_.](0[1-9]|1[0-2])[-_.](20\d{2})/

/** The version number in a filename: report_v3 → 3, "Deck rev 2.1" → 2.1. */
export const versionOf = (name: string) => Number(split(name).stem.match(VERSION)?.[1] ?? NaN)

/** A date written into a filename (2026-09-30, 20260930, 30-09-2026), as local midnight. */
export function dateInName(name: string): number | null {
  const stem = split(name).stem
  const iso = stem.match(ISO_DATE)
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime()
  const dmy = stem.match(DMY_DATE)
  return dmy ? new Date(+dmy[3], +dmy[2] - 1, +dmy[1]).getTime() : null
}

/** What a filename is about, without versions, dates, copy markers or words like "final". */
export function documentKey(name: string) {
  const { stem, ext } = split(name)
  const words = stem
    .replace(/^~\$/, "")
    .replace(VERSION, " ")
    .replace(ISO_DATE, " ")
    .replace(DMY_DATE, " ")
    .replace(/\s*\(\d+\)\s*$/, " ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !NOISE.has(word))
  const family = ext === "pdf" || OFFICE.has(ext) ? "document" : ext
  return `${words.join(" ")}|${family}`
}

/** The date an email subject talks about ("Minutes 14 Oct", "October invoice", "2026-10-14"), if any. */
export function subjectDate(subject: string, now: number): { time: number; period: "day" | "month" } | null {
  const text = String(subject ?? "")
  const thisYear = new Date(now).getFullYear()
  /** With no year given, use whichever year puts the date closest to today. */
  const pick = (month: number, day: number, year?: number) => {
    if (year) return new Date(year, month, day).getTime()
    const options = [thisYear - 1, thisYear, thisYear + 1].map((y) => new Date(y, month, day).getTime())
    return options.reduce((best, t) => (Math.abs(t - now) < Math.abs(best - now) ? t : best))
  }
  const month = (word: string) => MONTHS.indexOf(word.slice(0, 3).toLowerCase())
  const iso = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/)
  if (iso) return { time: new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime(), period: "day" }
  const name = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?"
  const dm = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${name},?(?:\\s+(20\\d{2}))?\\b`, "i"))
  if (dm && +dm[1] >= 1 && +dm[1] <= 31) return { time: pick(month(dm[2]), +dm[1], dm[3] ? +dm[3] : undefined), period: "day" }
  const md = text.match(new RegExp(`\\b${name}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:\\s+(20\\d{2}))?`, "i"))
  if (md && +md[2] >= 1 && +md[2] <= 31) return { time: pick(month(md[1]), +md[2], md[3] ? +md[3] : undefined), period: "day" }
  // A month alone: capitalised full names ("October invoice"), and "March", "May" or a short name only
  // with a year, so "the march to launch", "you may" and "august company" are not dates.
  const my = text.match(/\b(january|february|march|april|june|july|august|september|october|november|december|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?=\s+20\d{2}))(?:\s+(20\d{2}))?\b/i)
  if (!my || (!my[2] && (!/^[A-Z]/.test(my[1]) || /^march$/i.test(my[1])))) return null
  return { time: pick(month(my[1]), 1, my[2] ? +my[2] : undefined), period: "month" }
}

/**
 * Every reason this attachment may be the wrong copy: a newer save of the same file, a newer
 * version beside it, a lock file, a name that says draft/old/copy, or a date older than the
 * one the subject talks about. Pure, so it can run on a server.
 */
export function checkAttachment(
  file: StaleFile,
  nearby: StaleFile[] = [],
  { subject = "", now, graceDays = 1 }: { subject?: string; now?: number; graceDays?: number } = {},
): StaleIssue[] {
  const issues: StaleIssue[] = []
  const { stem } = split(file.name)
  const mine = toTime(file.modified)
  const key = documentKey(file.name)
  const version = versionOf(file.name)

  let best: StaleFile | null = null
  let bestBy: "time" | "version" = "time"
  for (const other of Array.isArray(nearby) ? nearby : []) {
    if (!other || other.id === file.id || typeof other.name !== "string") continue
    const theirs = toTime(other.modified)
    if (other.name === file.name) {
      if (mine !== null && theirs !== null && theirs - mine > 60_000) {
        issues.push({ kind: "changedSince", replacement: other })
        best = null
        break
      }
      continue
    }
    if (documentKey(other.name) !== key) continue
    const otherVersion = versionOf(other.name)
    const higher = otherVersion > version || (Number.isNaN(version) && otherVersion > 1)
    const lower = otherVersion < version
    const later = mine !== null && theirs !== null && theirs - mine > 60_000
    // report.pdf exported after report.docx is the same document in another format, not a newer copy:
    // across formats only a higher version number counts.
    const sameFormat = split(other.name).ext === split(file.name).ext
    if (!higher && !(later && !lower && sameFormat)) continue
    const beats = !best || versionOf(other.name) > versionOf(best.name) || (toTime(other.modified) ?? 0) > (toTime(best.modified) ?? 0)
    if (beats) [best, bestBy] = [other, higher && !later ? "version" : "time"]
  }
  if (best) issues.push({ kind: "newer", replacement: best, by: bestBy })

  if (now !== undefined) {
    const said = subjectDate(subject, now)
    const named = dateInName(file.name)
    const fileDate = named ?? mine
    // A file edited just before the date it is about is normal (a deck for today's meeting), so an
    // edit time gets `graceDays` of slack; a date written in the name must simply not be earlier.
    const slack = named !== null ? 0 : Math.max(0, graceDays) * DAY
    if (said && said.time <= now && fileDate !== null && fileDate < said.time - slack) {
      issues.push({ kind: "beforeSubject", source: named !== null ? "name" : "modified", fileDate, subjectDate: said.time, period: said.period })
    }
  }

  if (stem.startsWith("~$")) issues.push({ kind: "lockFile" })
  else {
    const words = stem.toLowerCase().split(/[^\p{L}\p{N}]+/u)
    const word = HINT_WORDS.find((hint) => words.includes(hint)) ?? (/\(\d+\)\s*$/.test(stem) ? stem.match(/\(\d+\)\s*$/)![0].trim() : undefined)
    if (word) issues.push({ kind: "nameHint", word })
  }
  return issues
}
