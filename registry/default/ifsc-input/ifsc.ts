// Bollard UI — ifsc-input · MIT licence · https://bollard-ui.vercel.app/components/ifsc-input

/** Branch details, shaped after the free Razorpay IFSC API (https://ifsc.razorpay.com/<IFSC>). */
export interface IfscDetails {
  bank: string
  bankCode: string
  branch: string
  city?: string
  state?: string
  address?: string
  neft?: boolean
  rtgs?: boolean
  imps?: boolean
  upi?: boolean
}

export type IfscRail = "NEFT" | "RTGS" | "IMPS" | "UPI"

/** Common bank codes (the first four letters), so the bank reads back before any lookup. */
export const IFSC_BANK_CODES: Record<string, string> = {
  SBIN: "State Bank of India", HDFC: "HDFC Bank", ICIC: "ICICI Bank", UTIB: "Axis Bank", KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank", BARB: "Bank of Baroda", CNRB: "Canara Bank", UBIN: "Union Bank of India", BKID: "Bank of India",
  INDB: "IndusInd Bank", YESB: "Yes Bank", IDFB: "IDFC First Bank", FDRL: "Federal Bank", IDIB: "Indian Bank",
  IOBA: "Indian Overseas Bank", CBIN: "Central Bank of India", UCBA: "UCO Bank", MAHB: "Bank of Maharashtra",
  RATN: "RBL Bank", AUBL: "AU Small Finance Bank", KARB: "Karnataka Bank", SIBL: "South Indian Bank", PYTM: "Paytm Payments Bank",
}

/** Codes people guess from the bank's name that are not its real IFSC prefix. */
export const IFSC_GUESSED_CODES: Record<string, string> = { AXIS: "UTIB", KOTK: "KKBK", KOTA: "KKBK", RBLB: "RATN", PNBB: "PUNB", BOBB: "BARB" }

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/

/** Uppercases and drops spaces, dots and dashes people paste from cheque books and statements. */
export const normalizeIfsc = (raw: string) => raw.toUpperCase().replace(/[\s.\-_/]/g, "")

export interface IfscProblem {
  message: string
  fix?: string
  fixLabel?: string
}

const LETTER_FOR_DIGIT: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B" }

/** Structural slips in an IFSC, each with a one-tap fix when the intended code is clear. */
export function findIfscProblem(code: string): IfscProblem | null {
  if (!code) return null
  const bank = code.slice(0, 4)
  if (/\d/.test(bank) && code.length >= 4) {
    const fixed = bank.replace(/[0158]/g, (d) => LETTER_FOR_DIGIT[d])
    return /^[A-Z]{4}$/.test(fixed)
      ? { message: "The first 4 characters are letters.", fix: fixed + code.slice(4), fixLabel: `Use ${fixed}` }
      : { message: "The first 4 characters are letters (the bank code)." }
  }
  if (IFSC_GUESSED_CODES[bank]) {
    const real = IFSC_GUESSED_CODES[bank]
    return { message: `${IFSC_BANK_CODES[real]} codes start with ${real}, not ${bank}.`, fix: real + code.slice(4), fixLabel: `Use ${real}` }
  }
  if (code.length >= 5 && code[4] === "O") {
    return { message: "The 5th character is the digit zero, not the letter O.", fix: `${bank}0${code.slice(5)}`, fixLabel: "Use 0" }
  }
  if (code.length === 10 && /^[A-Z]{4}[A-Z0-9]{6}$/.test(code) && code[4] !== "0") {
    return { message: "The 0 after the bank code seems to be missing.", fix: `${bank}0${code.slice(4)}`, fixLabel: "Add the 0" }
  }
  if (code.length >= 5 && code[4] !== "0") return { message: "The 5th character of an IFSC is always 0." }
  if (code.length > 11) return { message: `An IFSC has 11 characters; this has ${code.length}.` }
  if (/[^A-Z0-9]/.test(code)) return { message: "An IFSC has only letters and digits." }
  return null
}

/** The same code with every letter O in the branch part read as a zero, or null when there is none. */
export function branchWithZeros(code: string) {
  const branch = code.slice(5)
  return /[OI]/.test(branch) ? `${code.slice(0, 5)}${branch.replace(/O/g, "0").replace(/I/g, "1")}` : null
}

/** True when `picked` (a bank code or name) names the same bank as the IFSC's details. */
export function sameBank(picked: string, bankCode: string, bankName?: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\b(bank|ltd|limited|of|the)\b|[^a-z]/g, "")
  if (picked.toUpperCase() === bankCode) return true
  const name = bankName ?? IFSC_BANK_CODES[bankCode]
  return !!name && norm(picked) === norm(name)
}

interface RazorpayIfscResponse {
  BANK: string; BANKCODE: string; BRANCH: string; CITY?: string; STATE?: string; ADDRESS?: string
  NEFT?: boolean; RTGS?: boolean; IMPS?: boolean; UPI?: boolean
}

/**
 * A lookup backed by the public Razorpay IFSC API (or a self-hosted copy of it).
 * Resolves null for an unknown code (HTTP 404) and rejects on network failure.
 */
export function createRazorpayIfscLookup(baseUrl = "https://ifsc.razorpay.com") {
  return async (ifsc: string, signal: AbortSignal): Promise<IfscDetails | null> => {
    const res = await fetch(`${baseUrl}/${ifsc}`, { signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`IFSC lookup failed: ${res.status}`)
    const d: RazorpayIfscResponse = await res.json()
    return { bank: d.BANK, bankCode: d.BANKCODE, branch: d.BRANCH, city: d.CITY, state: d.STATE, address: d.ADDRESS, neft: d.NEFT, rtgs: d.RTGS, imps: d.IMPS, upi: d.UPI }
  }
}
