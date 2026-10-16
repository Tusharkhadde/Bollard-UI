/** What a one-time code approves. `other` uses `label` as the action ("This code {label}"). */
export type OtpActionKind = "payment" | "transfer" | "login" | "add-payee" | "change-contact" | "reset-password" | "other"

export interface OtpAction {
  kind: OtpActionKind
  /** Amount in major units (rupees) for payments and transfers. */
  amount?: number
  /** ISO 4217 currency. Defaults to INR. */
  currency?: string
  /** Merchant for a payment (not the gateway), or account holder for a transfer, as the bank names them. */
  payee?: string
  /** The new device for a login, e.g. "a Redmi phone in Jaipur". */
  device?: string
  /** For `other`: what the code does, in a verb phrase ("unlocks your card"). */
  label?: string
}

export type OtpRisk = "on-call" | "screen-share" | "mismatch"

export interface OtpContext {
  /** What the user started in this app, when known. A different `action.kind` means someone else asked for the code. */
  expected?: OtpActionKind
  /** The app knows a phone call is active. */
  onCall?: boolean
  /** The app knows the screen is being shared or recorded. */
  screenSharing?: boolean
}

/** Risks that call for the strong "never share" warning, most urgent first. */
export function otpRisks(action: OtpAction | undefined, context: OtpContext = {}): OtpRisk[] {
  const risks: OtpRisk[] = []
  if (context.screenSharing) risks.push("screen-share")
  if (context.onCall) risks.push("on-call")
  if (context.expected && action?.kind && context.expected !== action.kind) risks.push("mismatch")
  return risks
}

export function formatOtpAmount(amount: unknown, currency = "INR", locale = "en-IN") {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0) return ""
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}

/** Templates for the plain-language sentence. `{amount}`, `{payee}`, `{device}` and `{label}` are filled in. */
export const OTP_ACTION_TEXT = {
  payment: "This code approves a {amount} payment to {payee}.",
  paymentNoPayee: "This code approves a {amount} payment.",
  transfer: "This code sends {amount} from your account to {payee}.",
  transferNoPayee: "This code sends {amount} from your account.",
  login: "This code logs in a new device: {device}.",
  loginNoDevice: "This code logs in a new device.",
  "add-payee": "This code adds {payee} as someone you can send money to.",
  "add-payeeNoPayee": "This code adds a new payee who can receive your money.",
  "change-contact": "This code changes the phone number or email on your account.",
  "reset-password": "This code resets your password.",
  other: "This code {label}.",
}

export type OtpActionText = typeof OTP_ACTION_TEXT

const clean = (text: unknown, max = 80) =>
  typeof text === "string" ? text.replace(/^\uFEFF/, "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max) : ""

/** The one sentence that says what the code authorises, e.g. "This code approves a ₹24,999 payment to Croma." */
export function describeOtpAction(action: OtpAction | undefined, text: Partial<OtpActionText> = {}, locale = "en-IN"): string {
  const t = { ...OTP_ACTION_TEXT, ...text }
  const kind = action?.kind ?? "other"
  const payee = clean(action?.payee)
  const device = clean(action?.device)
  const amount = formatOtpAmount(action?.amount, action?.currency, locale)
  const fill = (template: string) =>
    template.replace("{amount}", amount || "money").replace("{payee}", payee).replace("{device}", device).replace("{label}", clean(action?.label) || "confirms an action on your account")
  switch (kind) {
    case "payment":
      return fill(payee ? t.payment : t.paymentNoPayee)
    case "transfer":
      return fill(payee ? t.transfer : t.transferNoPayee)
    case "login":
      return fill(device ? t.login : t.loginNoDevice)
    case "add-payee":
      return fill(payee ? t["add-payee"] : t["add-payeeNoPayee"])
    case "change-contact":
    case "reset-password":
      return fill(t[kind])
    default:
      return fill(t.other)
  }
}

/** Keeps digits and letters only, so pasted or padded codes never break the display. */
export function normalizeOtp(code: unknown): string {
  return typeof code === "string" || typeof code === "number" ? String(code).replace(/[^0-9A-Za-z]/g, "").slice(0, 12) : ""
}

/** "482917" → "482 917", "48291734" → "4829 1734": groups that are easy to read and say. */
export function groupOtp(code: string): string {
  if (code.length <= 4) return code
  const size = code.length % 3 === 0 ? 3 : 4
  return code.match(new RegExp(`.{1,${size}}`, "g"))!.join(" ")
}

/**
 * The SMS text in the order RBI asks for (merchant or payee and amount named, the code at the end,
 * tied to this one transaction): "Approve a ₹24,999 payment to Croma. Never share this code;
 * Acme Bank will never call for it. OTP: 482917".
 */
export function formatOtpSms(code: string, action: OtpAction | undefined, options: { brand?: string; validMinutes?: number; locale?: string; /** Draw the code as dots, for a preview. */ masked?: boolean } = {}): string {
  const brand = clean(options.brand) || "we"
  const sentence = describeOtpAction(action, {}, options.locale)
  const valid = options.validMinutes && options.validMinutes > 0 ? ` Valid ${Math.round(options.validMinutes)} min.` : ""
  const otp = normalizeOtp(code)
  return `${sentence} Never share this code; ${brand} will never call for it.${valid} OTP: ${options.masked ? "•".repeat(otp.length) : otp}`
}
