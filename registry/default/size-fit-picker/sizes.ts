// Bollard UI — size-fit-picker · MIT licence · https://bollard-ui.vercel.app/components/size-fit-picker

export type SizeSystem = "UK" | "US" | "EU" | "IN"

export interface SizeRow {
  /** Letter size for clothing ("M"), shown alongside the numbers. */
  label?: string
  /** The same size in each system. Leave a system out when it has no equivalent. */
  sizes: Partial<Record<SizeSystem, string>>
  /** Foot length in cm, the one measure that doesn't depend on a system. */
  cm?: number
}

export interface SizeChart {
  /** Stable id, so a remembered size can say which chart it came from. */
  id: string
  /** Shown when two charts are mixed up, e.g. "women's shoes". */
  name: string
  /** Smallest to largest. */
  rows: SizeRow[]
}

const shoe = (uk: number, us: number, eu: number, cm: number): SizeRow => ({ sizes: { UK: `${uk}`, US: `${us}`, EU: `${eu}`, IN: `${uk}` }, cm })

/** Men's shoes. India uses the UK number; US is one higher. */
export const MENS_SHOES: SizeChart = {
  id: "mens-shoes",
  name: "men's shoes",
  rows: [shoe(5, 6, 39, 23), shoe(6, 7, 40, 24), shoe(7, 8, 41, 25), shoe(8, 9, 42, 26), shoe(9, 10, 43, 27), shoe(10, 11, 44, 28), shoe(11, 12, 45, 29), shoe(12, 13, 46, 30)],
}

/** Women's shoes. India uses the UK number; US is two higher. */
export const WOMENS_SHOES: SizeChart = {
  id: "womens-shoes",
  name: "women's shoes",
  rows: [shoe(3, 5, 36, 22), shoe(4, 6, 37, 23), shoe(5, 7, 38, 24), shoe(6, 8, 39, 25), shoe(7, 9, 40, 26), shoe(8, 10, 41, 27)],
}

const dress = (label: string, uk: number, us: number, eu: number, ind: number): SizeRow => ({ label, sizes: { UK: `${uk}`, US: `${us}`, EU: `${eu}`, IN: `${ind}` } })

/** Women's clothing. Indian numeric sizes run US + 32 (US 6 = IN 38). */
export const WOMENS_CLOTHING: SizeChart = {
  id: "womens-clothing",
  name: "women's clothing",
  rows: [dress("S", 6, 4, 34, 36), dress("M", 8, 6, 36, 38), dress("L", 10, 8, 38, 40), dress("XL", 12, 10, 40, 42), dress("XXL", 14, 12, 42, 44)],
}

/** Index of the row holding `size` in `system` (a letter label also matches), or -1. */
export function findSize(chart: SizeChart, system: SizeSystem, size: string) {
  const want = size.trim().toUpperCase()
  return chart.rows.findIndex((row) => row.sizes[system]?.toUpperCase() === want || row.label?.toUpperCase() === want)
}

/** "UK 8 = US 9 = EU 42 = IN 8" for a row, in the order given. */
export function describeSize(row: SizeRow, systems: SizeSystem[]) {
  return systems.filter((s) => row.sizes[s]).map((s) => `${s} ${row.sizes[s]}`).join(" = ")
}

export interface SizeTrap {
  /** The row the shopper picked and the row they most likely meant. */
  picked: number
  meant: number
}

/**
 * The classic slip: picking your usual number in the wrong system (your UK 8 clicked
 * in the US row is a UK 7). Returns the row they probably meant, or null.
 */
export function findSizeTrap(chart: SizeChart, system: SizeSystem, picked: number, usual: { size: string; system: SizeSystem }): SizeTrap | null {
  if (system === usual.system || picked < 0) return null
  const meant = findSize(chart, usual.system, usual.size)
  const row = chart.rows[picked]
  if (meant < 0 || meant === picked || row.sizes[system]?.toUpperCase() !== usual.size.trim().toUpperCase()) return null
  return { picked, meant }
}
