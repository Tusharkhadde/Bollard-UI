// Bollard UI — eta-range · MIT licence · https://bollard-ui.vercel.app/components/eta-range

/** Delivery-estimate maths for EtaRange. Dates are whole days ("day numbers" since 1970-01-01) in the shipper's zone. */

export interface EtaInput {
  /** When the order is (or would be) placed. */
  now: Date | number
  /** The shipper's time zone: cutoffs and dispatch days follow its clock, not the shopper's. */
  timeZone?: string
  /** Last order time for same-day dispatch, "HH:MM" in `timeZone`. */
  cutoff?: string
  /** Business days to pack before dispatch; 0 means it leaves the day it is ordered (before cutoff). */
  processingDays?: number
  /** Share of parcels arriving on the 1st, 2nd, 3rd... delivery day after dispatch. Need not sum to 1. */
  transit: number[]
  /** Weekdays the shipper dispatches (0 = Sunday). Defaults to Monday–Friday. */
  workDays?: number[]
  /** Weekdays the carrier delivers. Defaults to Monday–Saturday. */
  deliveryDays?: number[]
  /** Closed days, "YYYY-MM-DD": no dispatch and no delivery. */
  holidays?: string[]
  /** Share of deliveries the quoted range must cover. Defaults to 0.9. */
  coverage?: number
}

export interface Eta {
  /** The order day in the shipper's zone. */
  orderDay: number
  /** Day the parcel leaves. */
  shipDay: number
  /** True when the order lands after the cutoff on a dispatch day, so it leaves a day later. */
  missedCutoff: boolean
  /** The cutoff instant (ms) that still gets `shipDay`, or null when today's has passed. */
  cutoffAt: number | null
  /** Every candidate delivery day with its share, earliest first. */
  days: { day: number; share: number }[]
  earliest: number
  latest: number
  /** The single most likely day, or null when no day carries at least 40%: then any day in the range is as likely. */
  likely: number | null
  likelyShare: number
  /** Days inside the range with no delivery (Sundays, holidays), so nobody counts them. */
  closed: number[]
}

const DAY = 86_400_000
export const weekday = (day: number) => (day + 4) % 7
export const dayFromIso = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY)

/** Local calendar day, minutes after midnight and UTC offset (ms) of an instant in a time zone. */
function localParts(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(instant)
      .map((p) => [p.type, Number(p.value)]),
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  return { day: Math.floor(asUtc / DAY), minutes: parts.hour * 60 + parts.minute, offset: asUtc - Math.floor(instant / 60_000) * 60_000 }
}

/** "4:00 pm IST": the cutoff as a wall time with the shipper's zone name, so nobody reads it in their own zone. */
export function formatCutoff(cutoff: string, timeZone: string, at: number, locale?: string) {
  const [h, m] = cutoff.split(":").map(Number)
  const time = new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(Date.UTC(2000, 0, 1, h, m))
  const zone = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value
  return zone ? `${time} ${zone}` : time
}

/** Turns dispatch rules and a transit distribution into an honest date range with a most likely day. */
export function estimateEta({
  now,
  timeZone = "Asia/Kolkata",
  cutoff = "16:00",
  processingDays = 0,
  transit,
  workDays = [1, 2, 3, 4, 5],
  deliveryDays = [1, 2, 3, 4, 5, 6],
  holidays = [],
  coverage = 0.9,
}: EtaInput): Eta {
  const closedDays = new Set(holidays.map(dayFromIso))
  const opens = (day: number, allowed: number[]) => allowed.includes(weekday(day)) && !closedDays.has(day)
  const instant = typeof now === "number" ? now : now.getTime()
  const { day: today, minutes, offset } = localParts(instant, timeZone)
  const [h, m] = cutoff.split(":").map(Number)
  const inTime = opens(today, workDays) && minutes < h * 60 + m

  let shipDay = today
  if (!inTime) do shipDay++; while (!opens(shipDay, workDays))
  for (let left = processingDays; left > 0; left--) do shipDay++; while (!opens(shipDay, workDays))

  const days: Eta["days"] = []
  for (let day = shipDay; days.length < transit.length; ) {
    do day++; while (!opens(day, deliveryDays))
    days.push({ day, share: transit[days.length] })
  }
  const total = transit.reduce((a, b) => a + b, 0) || 1
  // Trim the tails while the range still covers `coverage`; on a tie drop the early edge, so we never promise too soon.
  let [lo, hi, kept] = [0, days.length - 1, total]
  while (lo < hi) {
    const dropEarly = days[lo].share <= days[hi].share
    const share = dropEarly ? days[lo].share : days[hi].share
    if ((kept - share) / total < coverage - 1e-9) break
    kept -= share
    if (dropEarly) lo++
    else hi--
  }
  const inRange = days.slice(lo, hi + 1)
  const top = inRange.reduce((a, b) => (b.share > a.share ? b : a))
  const likelyShare = top.share / total
  const closed: number[] = []
  for (let day = days[lo].day + 1; day < days[hi].day; day++) if (!opens(day, deliveryDays)) closed.push(day)

  return {
    orderDay: today,
    shipDay,
    missedCutoff: opens(today, workDays) && !inTime,
    cutoffAt: inTime ? Date.UTC(1970, 0, 1 + today, h, m) - offset : null,
    days,
    earliest: days[lo].day,
    latest: days[hi].day,
    likely: likelyShare >= 0.4 && inRange.length > 1 ? top.day : null,
    likelyShare,
    closed,
  }
}
