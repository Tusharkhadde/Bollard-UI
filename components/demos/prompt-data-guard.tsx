"use client"

import * as React from "react"
import { Bot } from "lucide-react"

import { PromptDataGuard, restoreStandIns, type PromptAttachment } from "@/registry/default/prompt-data-guard/prompt-data-guard"

// Samsung engineers pasted source code and meeting notes into ChatGPT (March 2023, reported April 2023); OpenAI's API keeps
// inputs up to 30 days for abuse monitoring. Here a CRM export and a confidential deck are about to go too.
const FIRST = ["Asha", "Vikram", "Meera", "Rohan", "Priya", "Arjun", "Kavya", "Neel"]
const LAST = ["Rao", "Shah", "Iyer", "Kulkarni", "Menon", "Desai", "Joshi", "Nair"]
const ROWS = Array.from({ length: 248 }, (_, i) => {
  const first = FIRST[i % 8]
  const last = LAST[Math.floor(i / 8) % 8]
  const phone = `98${String(22000000 + i * 3917).padStart(8, "0")}`
  return `${first} ${last},${first.toLowerCase()}.${last.toLowerCase()}${i}@gmail.com,+91 ${phone.slice(0, 5)} ${phone.slice(5)},${i % 3 ? "Pro" : "Free"},${(i * 7) % 90} days`
})
const PROMPT = `Which of these customers are most likely to churn? Draft a win-back email for the top 3.\n\nname,email,phone,plan,last_login\n${ROWS.join("\n")}`
const FILES: PromptAttachment[] = [
  { id: "deck", name: "Q3-pricing-plan.docx", text: "CONFIDENTIAL\nQ3 pricing: Pro goes from ₹999 to ₹1,499 on 1 November. Do not tell customers before the 25th." },
]

export function Demo() {
  const [text, setText] = React.useState(PROMPT)
  const [files, setFiles] = React.useState(FILES)
  const [reply, setReply] = React.useState<string | null>(null)

  return (
    <div className="grid w-full max-w-md gap-3">
      <PromptDataGuard
        value={text}
        onValueChange={setText}
        attachments={files}
        onRemoveAttachment={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
        destination={{ name: "OpenAI", retention: "up to 30 days" }}
        placeholder="Ask anything"
        onSend={async ({ mapping, protected: safe }) => {
          await new Promise((r) => setTimeout(r, 500))
          // The model only ever saw stand-ins; the real names come back on this device.
          const fromModel = "Top churn risk: <NAME_3> (‹EMAIL_3›), last seen 90 days ago. Draft: \"Hi ‹NAME_3›, we miss you…\""
          setReply(safe ? restoreStandIns(fromModel, mapping) : "Top churn risk: Meera Rao, last seen 90 days ago.")
          setText("")
        }}
      />
      {reply && (
        <p className="flex gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm">
          <Bot aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-words">{reply}</span>
        </p>
      )}
    </div>
  )
}
