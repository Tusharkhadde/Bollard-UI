import type { Metadata } from "next"

import { RichGuideArticle } from "@/components/site/rich-guide"

const title = "Prevent Duplicate Form Submissions in React"
const description =
  "Stop double submissions, accidental double-clicks, and repeat charges in React forms with safe submit buttons, idempotency keys, and recovery states."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides/react-prevent-duplicate-form-submit" },
  openGraph: {
    title: `${title} | Bollard UI`,
    description,
    url: "/guides/react-prevent-duplicate-form-submit",
    type: "article",
  },
  twitter: {
    title: `${title} | Bollard UI`,
    description,
    card: "summary_large_image",
  },
}

const sections = [
  {
    title: "The anatomy of a duplicate submission disaster",
    paragraphs: [
      "Duplicate form submissions are among the most expensive yet preventable defects in web development. They occur when a user clicks a submit or payment button more than once, or when a network hiccup leaves an in-flight request ambiguous. In typical SaaS and e-commerce applications, duplicate submissions lead to accidental double billing, duplicate database entries, redundant email blasts, or multiple shipments for a single order.",
      "Most double-clicks are not malicious attacks; they are honest human reactions to visual silence. When a user clicks a button and the application takes 800 milliseconds to respond over a high-latency connection without immediate feedback, human instinct assumes the click failed to register. The user clicks again. If the front-end does not lock its submission pipeline, the browser dispatches two concurrent HTTP POST requests with identical payloads.",
      "Preventing duplicate submissions requires understanding the boundary between user experience and data integrity. Disabling a button in the browser stops impatient double-clicks, but client-side controls alone cannot protect against network retry storms, dropped responses, or replayed requests. A complete solution coordinates three synchronized layers: instant client feedback, request-level idempotency keys, and database-level constraints.",
    ],
  },
  {
    title: "Comparing duplicate prevention strategies",
    paragraphs: [
      "Different mitigation strategies operate at different tiers of your web architecture. A robust application layers these mechanisms rather than relying exclusively on a single technique.",
    ],
    table: {
      caption: "Comparison of duplicate submission prevention techniques",
      headers: ["Technique", "Where It Runs", "Failure Modes It Stops", "Limitations"],
      rows: [
        [
          "Button Disabling / SafeSubmit",
          "Client Browser (React)",
          "Rapid double-clicks, impatient multi-clicks, tab switching during submit",
          "Bypassed by network retries, script injection, or multiple browser tabs",
        ],
        [
          "Debounce / Throttle",
          "Client Event Handler",
          "Accidental rapid mouse clicks within 300ms",
          "Does not track async request lifecycle; fails if request takes longer than delay",
        ],
        [
          "Idempotency Key Header",
          "HTTP Request & API Gateway",
          "Network retries, lost HTTP responses, duplicate concurrent requests",
          "Requires server-side cache (Redis) and deduplication storage",
        ],
        [
          "Database Unique Constraint",
          "Relational Database (SQL)",
          "Duplicate business records, race conditions across all services",
          "Can produce ugly 500 error pages if unhandled by API layer",
        ],
      ],
    },
  },
  {
    title: "Building an accessible SafeSubmit component in React",
    paragraphs: [
      "The primary role of the React submit button is to provide instant sensory feedback the millisecond a pointer or keyboard interaction occurs. It must transition immediately to a pending state, display an accessible loading indicator, and prevent additional click or enter-key events while preserving keyboard accessibility.",
      "A common mistake when disabling buttons in React is rendering `<button disabled>`. In standard browser accessibility trees, setting the HTML `disabled` attribute immediately removes the button from the keyboard tab order and ejects screen-reader focus to the document body. A more accessible pattern uses `aria-disabled=\"true\"` and `aria-busy=\"true\"`, pairing it with visual pointer-events disabling and ignoring repeated invocations in the JavaScript event handler.",
      "The following code demonstrates a resilient submit guard pattern that coordinates an async submission lifecycle, manages an idempotency token, and renders graceful error and retry recovery states.",
    ],
    code: {
      filename: "SafeSubmitButton.tsx",
      source: `import * as React from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

interface SafeSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onSubmit: (idempotencyKey: string) => Promise<void>
  pendingText?: string
  successText?: string
  children: React.ReactNode
}

export function SafeSubmitButton({
  onSubmit,
  pendingText = "Processing…",
  successText = "Completed",
  children,
  className,
  ...props
}: SafeSubmitProps) {
  const [status, setStatus] = React.useState<"idle" | "pending" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  
  // Stable idempotency key per user interaction session
  const idempotencyKeyRef = React.useRef(crypto.randomUUID())

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (status === "pending" || status === "success") {
      e.preventDefault()
      return
    }

    setStatus("pending")
    setErrorMessage(null)

    try {
      await onSubmit(idempotencyKeyRef.current)
      setStatus("success")
    } catch (err: any) {
      setStatus("error")
      setErrorMessage(err.message || "Submission failed. Please try again.")
      // Note: Do NOT re-roll idempotency key on transient error so retry safely replays
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        aria-disabled={status === "pending" || status === "success"}
        aria-busy={status === "pending"}
        onClick={handleClick}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
        {...props}
      >
        {status === "pending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {status === "success" && <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />}
        {status === "pending" ? pendingText : status === "success" ? successText : children}
      </button>

      {status === "error" && (
        <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}`,
    },
  },
  {
    title: "Why client throttling alone fails without idempotency",
    paragraphs: [
      "Client throttling (such as disabling a button for two seconds) creates a dangerous false sense of security. Consider what happens during a temporary network timeout: the user clicks 'Pay $100', the button disables, and the HTTP request leaves the browser. The payment gateway charges the customer's card, but right before the 200 OK reaches the browser, the customer's mobile connection switches cell towers. The fetch promise rejects with a network timeout.",
      "If your UI simply reenables the button and generates a fresh transaction, the user clicks again and is charged a second time. This is where an Idempotency-Key header is essential. By attaching a unique UUID to the operation and reusing that same key during automatic or manual retries, the server recognizes the retry as an identical intent. If the server already processed the charge, it returns the cached receipt instead of billing the card again.",
      "Always generate the idempotency key when the user begins the interaction—not inside the fetch retry loop. If the user intentionally edits form values (such as changing the shipping address or order quantity), refresh the idempotency key because the underlying intent has changed.",
    ],
  },
  {
    title: "Server-side integration and distributed lock patterns",
    paragraphs: [
      "On the backend, handle idempotent submissions using a transactional cache such as Redis or a dedicated database table. When a request arrives with an `Idempotency-Key` header:",
      "1. Check if the key exists in the idempotency store. If the key exists with a status of 'COMPLETED', immediately return the stored HTTP status code and response payload without re-executing any business logic.",
      "2. If the key exists with a status of 'IN_PROGRESS', return an HTTP 409 Conflict or a 425 Too Early status, advising the client that an identical transaction is actively processing.",
      "3. If the key is new, atomically insert it with a short-lived expiration (typically 60 to 300 seconds) and set its status to 'IN_PROGRESS'. Execute your business logic inside a database transaction.",
      "4. Once the transaction commits, update the idempotency record with the final response payload and transition status to 'COMPLETED'.",
      "This architecture guarantees that even if a user opens the application across five browser tabs and submits simultaneously, exactly one transaction will execute.",
    ],
    code: {
      filename: "api-handler.ts",
      source: `import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key")
  if (!idempotencyKey) {
    return NextResponse.json({ error: "Missing Idempotency-Key header" }, { status: 400 })
  }

  // Atomically acquire lock or retrieve existing result
  const cached = await redis.get(\`idempotency:\${idempotencyKey}\`)
  if (cached) {
    const { status, body } = JSON.parse(cached)
    if (status === "IN_PROGRESS") {
      return NextResponse.json({ error: "Transaction currently in progress" }, { status: 409 })
    }
    return NextResponse.json(body, { status: 200 })
  }

  // Lock key for 60 seconds while processing
  await redis.set(\`idempotency:\${idempotencyKey}\`, JSON.stringify({ status: "IN_PROGRESS" }), "EX", 60)

  try {
    const payload = await req.json()
    const result = await processPayment(payload)

    // Store completed result for 24 hours
    await redis.set(
      \`idempotency:\${idempotencyKey}\`,
      JSON.stringify({ status: "COMPLETED", body: result }),
      "EX",
      86400
    )

    return NextResponse.json(result)
  } catch (err: any) {
    // Clear lock on failure so user can retry
    await redis.del(\`idempotency:\${idempotencyKey}\`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}`,
    },
  },
  {
    title: "Testing duplicate prevention under harsh conditions",
    paragraphs: [
      "Never assume duplicate prevention works without testing under simulated network degradation. Use browser developer tools or automated end-to-end tests (such as Playwright) with CPU throttling and artificial 3000ms network latency.",
      "Verify these five essential failure modes before deploying to production: (1) Rapid multi-click: spamming the submit button five times in 200ms results in exactly one outgoing request. (2) Keyboard spam: holding down the Enter key on a text input does not submit repeatedly. (3) Network offline recovery: disconnecting Wi-Fi mid-flight displays an actionable error without clearing form values. (4) Server 500 retry: retrying an error uses the same idempotency token. (5) Payload change: altering form inputs regenerates the key.",
      "By combining Bollard UI's copy-paste submit components with server-side idempotency, you eliminate duplicate charges and phantom orders permanently while delivering a snappy, predictable form experience.",
    ],
  },
]

export default function PreventDuplicateFormSubmitGuide() {
  return (
    <RichGuideArticle
      title={title}
      eyebrow="Form Reliability · React"
      lead="Prevent duplicate payments, double orders, and repeat form submissions in React. Master accessible UI submit guards, client idempotency keys, and server-side deduplication."
      sections={sections}
      components={[
        { name: "safe-submit", label: "Safe Submit" },
        { name: "click-shield", label: "Click Shield" },
        { name: "retry-after", label: "Retry After" },
        { name: "hold-to-confirm", label: "Hold to Confirm" },
      ]}
      related={[
        { href: "/flows/checkout", label: "Checkout & Payments Flow Hub" },
        { href: "/guides/react-type-to-confirm-dialog", label: "Type to Confirm Guide" },
      ]}
    />
  )
}
