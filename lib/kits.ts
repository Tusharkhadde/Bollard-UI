// Discovery vocabulary shared by the server and the client: flows ("where it
// happens"), field types, the essentials shown first, and one curated kit per flow.
// Client-safe: no Node imports.

export const FLOWS = [
  { id: "checkout", label: "Checkout & payments", short: "Checkout" },
  { id: "signup-login", label: "Sign-up & login", short: "Sign-up" },
  { id: "account-settings", label: "Account settings", short: "Settings" },
  { id: "danger-zone", label: "Danger zone", short: "Danger zone" },
  { id: "forms", label: "Forms & data entry", short: "Forms" },
  { id: "messaging", label: "Messaging & sharing", short: "Messaging" },
  { id: "devtools", label: "Dev tools & infra", short: "Dev tools" },
  { id: "scheduling", label: "Dates & scheduling", short: "Scheduling" },
  { id: "india", label: "India", short: "India" },
] as const

export type FlowId = (typeof FLOWS)[number]["id"]

export const FIELDS = [
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "amount", label: "Amount" },
  { id: "datetime", label: "Date & time" },
  { id: "secret", label: "Secret / key" },
  { id: "file", label: "File" },
  { id: "id-number", label: "ID number" },
  { id: "url", label: "URL" },
  { id: "code", label: "Code" },
  { id: "text", label: "Text" },
  { id: "address", label: "Address" },
  { id: "name", label: "Name" },
  { id: "number", label: "Number" },
] as const

export type FieldId = (typeof FIELDS)[number]["id"]

export const FLOW_IDS: string[] = FLOWS.map((f) => f.id)
export const FIELD_IDS: string[] = FIELDS.map((f) => f.id)

export const flowLabel = (id: string) => FLOWS.find((f) => f.id === id)?.label ?? id
export const flowShort = (id: string) => FLOWS.find((f) => f.id === id)?.short ?? id
export const fieldLabel = (id: string) => FIELDS.find((f) => f.id === id)?.label ?? id

/** The components most people need first. Shown before everything else when there's no query, and boosted in search. */
export const ESSENTIALS = [
  "email-input",
  "amount-input",
  "phone-input",
  "password-input",
  "type-to-confirm",
  "undo-toast",
  "hold-to-confirm",
  "safe-submit",
  "duplicate-payment-guard",
  "secret-paste-guard",
  "otp-paste-input",
  "draft-restore",
  "unsaved-changes-bar",
  "danger-zone",
  "environment-badge",
  "unambiguous-date",
]

export interface Kit {
  flow: FlowId
  title: string
  blurb: string
  components: string[]
}

/** One curated kit per flow, 4–8 components, installable in one command. Names missing from the catalog are skipped. */
export const KITS: Kit[] = [
  {
    flow: "checkout",
    title: "Checkout kit",
    blurb: "The extra zero, the double charge, the expired card and the surprise total.",
    components: ["amount-input", "safe-submit", "duplicate-payment-guard", "card-expiry-input", "coupon-input", "charge-summary", "address-check"],
  },
  {
    flow: "signup-login",
    title: "Sign-up kit",
    blurb: "Typo'd emails, unreachable numbers, weak passwords and fumbled codes.",
    components: ["email-input", "password-input", "username-input", "phone-input", "otp-paste-input", "name-input"],
  },
  {
    flow: "account-settings",
    title: "Settings kit",
    blurb: "Email changes, sessions, recovery contacts and edits that never saved.",
    components: ["email-change-guard", "session-list", "unsaved-changes-bar", "recovery-contact-cooldown", "reauth-gate", "backup-codes"],
  },
  {
    flow: "danger-zone",
    title: "Danger zone kit",
    blurb: "Deletes, transfers and resets that need a deliberate second look.",
    components: ["danger-zone", "type-to-confirm", "account-deletion-readback", "hold-to-confirm", "undo-toast", "archive-or-delete", "transfer-ownership"],
  },
  {
    flow: "forms",
    title: "Forms kit",
    blurb: "Lost drafts, double submits, hidden errors and dates that make no sense.",
    components: ["draft-restore", "unsaved-changes-bar", "error-summary", "safe-submit", "date-sanity-input", "review-step"],
  },
  {
    flow: "messaging",
    title: "Messaging kit",
    blurb: "Wrong recipient, reply-all, the forgotten attachment and the leaked key.",
    components: ["reply-all-guard", "recipient-check", "attachment-nudge", "grace-send", "secret-paste-guard", "mention-guard"],
  },
  {
    flow: "devtools",
    title: "Dev tools kit",
    blurb: "Production by accident, force-pushes, unbounded SQL and piped installs.",
    components: ["environment-badge", "kube-context-guard", "force-push-confirm", "sql-guard", "env-paste", "curl-pipe-guard", "migration-preview"],
  },
  {
    flow: "scheduling",
    title: "Scheduling kit",
    blurb: "03/04 read the wrong way, the wrong time zone and the clash nobody saw.",
    components: ["unambiguous-date", "timezone-picker", "time-confirm", "relative-date-input", "timezone-mismatch", "event-overlap"],
  },
  {
    flow: "india",
    title: "India kit",
    blurb: "+91 numbers, Aadhaar, IFSC, UPI, PIN codes and lakh-aware amounts.",
    components: ["phone-input", "aadhaar-input", "ifsc-input", "upi-id-input", "pincode-input", "amount-input", "gst-invoice-check"],
  },
]

export const kitFor = (flow: string) => KITS.find((k) => k.flow === flow)

/** Where a flow link goes. One place to change it if the components index moves from ?flow= to an anchor. */
export const flowHref = (flow: string) => `/components?flow=${flow}`
