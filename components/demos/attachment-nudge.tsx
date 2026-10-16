"use client"

import * as React from "react"

import { AttachmentNudge, type Attachment } from "@/registry/default/attachment-nudge/attachment-nudge"

const FILES = ["Q3-invoice.pdf", "site-photos.zip", "contract-v2.docx"]

export function Demo() {
  const [message, setMessage] = React.useState(
    "Hi Priya,\n\nPFA the revised invoice for September. Let me know if anything looks off."
  )
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [sent, setSent] = React.useState<string>()

  const attach = () =>
    setAttachments((current) => {
      const name = FILES[current.length % FILES.length]
      return [...current, { id: `${name}-${current.length}`, name }]
    })

  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <AttachmentNudge
        label="Email body"
        value={message}
        onValueChange={setMessage}
        attachments={attachments}
        onAttach={attach}
        onRemoveAttachment={(id) => setAttachments((current) => current.filter((file) => file.id !== id))}
        onSend={() => {
          setSent(attachments.length ? `Sent with ${attachments.length} attachment(s).` : "Sent without attachments.")
          setAttachments([])
        }}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {sent ?? "Try Send. Also try “attach kar diya hai” or “I'll attach it later”."}
      </p>
    </div>
  )
}
