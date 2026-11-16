import type { Metadata } from "next"

import { RichGuideArticle } from "@/components/site/rich-guide"
import { catalog } from "@/lib/catalog"

const title = "React Form Validation for India: Aadhaar, UPI & More"
const description = "Build India-aware React forms for Aadhaar, IFSC, UPI IDs, PIN codes, +91 phones and lakh-aware amounts, with careful client and server validation."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides/react-india-form-validation" },
  openGraph: { title: `${title} | Bollard UI`, description, url: "/guides/react-india-form-validation", type: "article" },
  twitter: { title: `${title} | Bollard UI`, description, card: "summary_large_image" },
}

const components = ["aadhaar-input", "ifsc-input", "upi-id-input", "pincode-input", "phone-input", "amount-input"]
  .map((name) => catalog.find((item) => item.name === name))
  .filter((item): item is (typeof catalog)[number] => !!item && (item.flows ?? []).includes("india"))
  .map((item) => ({ name: item.name, label: item.title }))

const sections = [
  {
    title: "Design for Indian identifiers without pretending to verify them",
    paragraphs: [
      "India-facing forms often combine values that look similar to ordinary text but have distinct formats and very different privacy expectations. Aadhaar is a twelve-digit identifier commonly displayed in groups of four; an IFSC has eleven characters; a UPI ID is a virtual payment address such as name@bank; and a PIN code has six digits. A helpful input can guide grouping, length and obvious character errors while preserving what the person typed and explaining what comes next.",
      "Client validation only answers whether a value has a plausible shape. It cannot prove that an Aadhaar belongs to the person, that an IFSC is active, that a UPI handle accepts payments, or that a postal PIN code maps to the chosen address today. Make that distinction visible in the copy. Submit only the data required for the task, protect it in transit and at rest, and verify high-risk values through the service responsible for the transaction.",
    ],
  },
  {
    title: "Keep Aadhaar entry private and readable",
    paragraphs: [
      "Aadhaar input should avoid asking for the identifier unless the product has a clear need and an appropriate process. If it is needed, accept pasted digits with or without spaces, normalize for validation, and render a grouped readback so a person can spot a transposed digit. Avoid logging the raw value in analytics, client error reports or URLs. Mask it after confirmation where the task does not need the full number to remain visible.",
      "Do not present a format check as identity verification. State whether the value is still being checked, whether the user can correct it, and which trusted verification process follows. This reduces accidental rejection and prevents a green checkmark from implying an assurance the browser cannot provide.",
    ],
    code: { filename: "Aadhaar field", source: `import { AadhaarInput } from "@/components/ui/aadhaar-input"\n\n<AadhaarInput\n  label="Aadhaar number"\n  hint="Enter the number only if it is required for this task."\n  onValueChange={setAadhaar}\n/>` },
  },
  {
    title: "Treat IFSC and UPI as identifiers with live ownership checks",
    paragraphs: [
      "An IFSC field can uppercase letters and catch a value that is clearly too short or contains forbidden characters. That is useful feedback, but bank branch directories change and a correctly shaped code can still be closed or unsuitable for a particular transfer. Resolve it with your payment or banking provider before enabling a consequential action, then show the institution or branch information returned by that trusted source for a deliberate readback.",
      "UPI IDs are especially important to handle fairly. Provider handle lists are incomplete and can become stale, so an unfamiliar suffix should not be automatically called invalid. Let the payment provider make the real availability and payee checks. If a verified payee name is available, display it before payment and ask the user to confirm that recipient.",
    ],
    code: { filename: "UPI ID input", source: `import { UpiIdInput } from "@/components/ui/upi-id-input"\n\n<UpiIdInput\n  label="UPI ID"\n  value={upiId}\n  onValueChange={setUpiId}\n  expectedName={verifiedPayeeName}\n  verify={verifyWithPaymentProvider}\n/>` },
  },
  {
    title: "Make six-digit PIN codes and +91 numbers fit the user’s context",
    paragraphs: [
      "A six-digit PIN code is a useful input format, not a promise that the location or delivery service is available. Keep the entered value tied to the selected country and address, and show a specific message if the delivery or service lookup does not support it. Preserve leading zeroes by storing a PIN code as a string rather than a number.",
      "Phone numbers also need context. A +91 number can be typed with spaces, a leading zero or a country prefix depending on the user’s device and previous experience. Prefer an international phone parser and a country selector, retain the normalized E.164 value for communication, and show the formatted number before sending an OTP. An OTP proves control of that channel at that moment; it does not prove a person’s identity.",
    ],
    code: { filename: "Phone and PIN fields", source: `import { PhoneInput } from "@/components/ui/phone-input"\nimport { PincodeInput } from "@/components/ui/pincode-input"\n\n<PhoneInput country="IN" label="Mobile number" value={phone} onValueChange={setPhone} />\n<PincodeInput label="PIN code" value={pinCode} onValueChange={setPinCode} />` },
  },
  {
    title: "Use Indian numbering when amounts can be misread",
    paragraphs: [
      "Indian users may read amounts in thousands, lakhs and crores, while an application or payment API may store paise as an integer. A displayed amount such as ₹5,00,000 has a different scan pattern from ₹50,000, and a misplaced zero can be costly. Format with the Indian locale, keep the canonical amount separate from presentation, and show a readback before a high-value action. A history-based warning should explain the comparison and allow correction rather than silently rewriting the value.",
      "The amount input is a UX guard rail; the server must still enforce currency, limits, account permissions, balance and idempotency. Treat user-specific transaction history as sensitive data and do not add it to a shared browser cache without a deliberate privacy review.",
    ],
    code: { filename: "Lakh-aware payment amount", source: `import { AmountInput } from "@/components/ui/amount-input"\n\n<AmountInput\n  label="Transfer amount"\n  currency="INR"\n  locale="en-IN"\n  value={paise}\n  onValueChange={setPaise}\n/>` },
  },
  {
    title: "Build one useful validation sequence",
    paragraphs: [
      "Validate locally for immediate feedback, then validate again at the server boundary with the authoritative service. Keep each field’s error close to its label, connect it through accessible descriptions, and summarize blocking errors when submission fails. Do not make a person re-enter unrelated fields because one lookup timed out. Preserve the value, explain whether retrying is safe and distinguish a network failure from an invalid identifier.",
      "These components can be installed individually from the India flow. Start with the smallest field that addresses a demonstrated error, test it with realistic pasted and autofilled values, and inspect the screen-reader announcement as well as the visual state. Use the component’s limitations as a checklist for what your own API still needs to verify.",
    ],
  },
]

export default function IndiaFormGuide() {
  return <RichGuideArticle title={title} eyebrow="India · React forms" lead="A practical guide to India-aware form validation: make identifiers easier to enter and review while leaving ownership, eligibility and payment verification to the right service." sections={sections} components={components} related={[{ href: "/india", label: "India component collection" }]} />
}
