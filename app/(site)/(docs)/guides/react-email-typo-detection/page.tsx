import type { Metadata } from "next"

import { RichGuideArticle } from "@/components/site/rich-guide"

const title = "React Email Typo Detection: Suggest, Don't Edit"
const description = "Catch common email domain typos in React forms with a clear suggestion, keep the user in control and verify mailbox ownership on the server."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides/react-email-typo-detection" },
  openGraph: { title: `${title} | Bollard UI`, description, url: "/guides/react-email-typo-detection", type: "article" },
  twitter: { title: `${title} | Bollard UI`, description, card: "summary_large_image" },
}

const sections = [
  {
    title: "Catch likely typos without rejecting valid addresses",
    paragraphs: [
      "An email can be syntactically plausible and still miss the person because a familiar domain was mistyped. Addresses such as priya@gmial.com or alex@example.con deserve a gentle prompt when the user may have meant gmail.com or example.com. The goal is to prevent a lost receipt, invitation or account recovery message while preserving the address the person chose unless they accept a correction.",
      "Do not treat a domain suggestion as proof that an address is invalid. People use custom domains, regional providers, school domains and new services. Detection should be based on a small, explainable set of common mistakes or an established typo matcher, then give the person a clear choice to use the original value or apply the suggestion.",
    ],
  },
  {
    title: "Show the correction next to the field",
    paragraphs: [
      "A helpful prompt repeats the address and identifies the proposed change: “Did you mean priya@gmail.com?” Make the suggestion actionable with a button or an explicit confirmation control, and keep the typed value intact until the user selects it. Avoid silently rewriting on blur; the user may have intentionally entered a nonstandard domain, and an invisible correction can make it hard to understand what will receive the message.",
      "The example below uses the Bollard email input as a field-level enhancement. Connect its value state to your form library as needed, and keep the label and error wiring consistent with the rest of the form.",
    ],
    code: { filename: "EmailSignup.tsx", source: `import { EmailInput } from "@/components/ui/email-input"\n\nexport function EmailSignup() {\n  const [email, setEmail] = React.useState(\"\")\n\n  return (\n    <form onSubmit={(event) => submitSignup(event, email)}>\n      <EmailInput\n        label=\"Work email\"\n        value={email}\n        onValueChange={setEmail}\n        autoComplete=\"email\"\n      />\n      <button type=\"submit\">Create account</button>\n    </form>\n  )\n}` },
  },
  {
    title: "Keep validation layers separate",
    paragraphs: [
      "Browser checks can catch a missing at sign or obvious whitespace. Domain typo detection can offer a likely correction. Neither determines whether a mailbox exists or whether the person controls it. After signup, send a verification link or code and treat the address as unverified until the user completes that step. Re-check ownership before sensitive account changes such as recovery or billing contact updates.",
      "Server validation should normalize only what your product explicitly supports, reject dangerous input, and avoid sending to an address the person did not approve. Keep account-enumeration protections in mind: error text should not disclose whether someone else already has an account unless that disclosure is part of a deliberate flow.",
    ],
  },
  {
    title: "Make the prompt accessible and easy to dismiss",
    paragraphs: [
      "The correction needs to be understandable without color. Use concise text that identifies both the current value and the suggestion, and make the action reachable by keyboard. Announce the prompt after it appears without interrupting every keystroke. If the value changes, update or dismiss stale suggestions so the prompt cannot apply to a previous address.",
      "On mobile, the prompt should fit below the field and have a target large enough to tap. Do not hide it in a hover-only tooltip. Keep the field’s label visible, retain the browser’s email autocomplete semantics, and avoid blocking paste because users commonly paste an address from another application.",
    ],
  },
  {
    title: "Avoid false confidence from domain lists",
    paragraphs: [
      "A list of popular domains is useful for suggestions, but it ages and cannot include every legitimate provider. If your product supports an organization domain or a user-supplied domain, make the suggestion logic configurable or disable it for that field. A typo scorer should use a conservative threshold and avoid proposing changes to the local part, which is more likely to be personal and less predictable.",
      "Measure whether the suggestion helps by tracking a coarse event such as accepted or dismissed, not by sending raw addresses to analytics. If you need to debug a report, redact or hash identifiers under a documented retention policy. The correction feature should reduce delivery mistakes without turning each keystroke into a new personal-data record.",
    ],
  },
  {
    title: "Test real entry patterns before launch",
    paragraphs: [
      "Test a familiar typo, a valid custom domain, uppercase input, pasted whitespace, an address with a plus tag, a slow verification request and a user who rejects the suggestion. Confirm that form submission uses the value currently shown in the field. If a suggestion is accepted, make the changed value visible before the form is sent.",
      "The component is MIT licensed and copied into your application through the shadcn CLI. You own the source and can tailor the domain set, language and interaction to your audience. Pair typo assistance with server-side ownership verification instead of treating either feature as a substitute for the other.",
    ],
  },
]

export default function EmailTypoGuide() {
  return <RichGuideArticle title={title} lead="A useful email typo prompt catches a likely mistake while keeping the original address visible and the final choice with the user." sections={sections} components={[{ name: "email-input", label: "Email Input" }, { name: "email-change-guard", label: "Email Change Guard" }, { name: "use-bollard-field", label: "useBollardField" }]} />
}
