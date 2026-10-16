"use client"

import * as React from "react"

import { readUnsent, saveUnsent, UnsentMarker, useUnsentDraft, type UnsentDraft } from "@/registry/default/unsent-marker/unsent-marker"

type Chat = "priya" | "arjun"
const CHATS: Record<Chat, { name: string; last: string }> = {
  priya: { name: "Priya", last: "Can you confirm the ₹500 deposit by tonight?" },
  arjun: { name: "Arjun", last: "Sent you the venue photos." },
}
const keyOf = (chat: Chat) => `cui-demo-unsent:${chat}`

function Thread({ chat }: { chat: Chat }) {
  const [value, setValue] = React.useState("")
  const [sent, setSent] = React.useState<string[]>([])
  const { draft, clear } = useUnsentDraft(keyOf(chat), value)

  const send = (text: string) => {
    setSent((s) => [...s, text])
    setValue("")
    clear()
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="grid min-h-40 grid-cols-[minmax(0,1fr)] content-end gap-2 rounded-lg border bg-background p-3">
        <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm">{CHATS[chat].last}</p>
        {sent.map((text, i) => (
          <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
            {text}
          </p>
        ))}
        {draft && (
          <UnsentMarker
            text={draft.text}
            at={draft.at}
            recipient={CHATS[chat].name}
            onSend={async (text) => {
              await new Promise((resolve) => setTimeout(resolve, 400))
              send(text)
            }}
            onEdit={(text) => {
              setValue(text)
              clear()
            }}
            onDiscard={clear}
          />
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim()) send(value.trim())
        }}
      >
        <input
          aria-label={`Message ${CHATS[chat].name}`}
          placeholder={`Message ${CHATS[chat].name}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Send
        </button>
      </form>
    </div>
  )
}

export function Demo() {
  const [chat, setChat] = React.useState<Chat>()
  const [drafts, setDrafts] = React.useState<Partial<Record<Chat, UnsentDraft | null>>>({})

  // Seed one draft "left two hours ago" before the thread mounts, so the demo opens on the catch.
  React.useEffect(() => {
    saveUnsent(keyOf("priya"), "Yes, confirmed! Paying the deposit tonight.", Date.now() - 2 * 3_600_000)
    localStorage.removeItem(keyOf("arjun"))
    setChat("priya")
  }, [])

  const open = (next: Chat) => {
    setChat(next)
    setDrafts({ priya: readUnsent(keyOf("priya")), arjun: readUnsent(keyOf("arjun")) })
  }

  return (
    <div className="grid w-full max-w-sm min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div role="tablist" aria-label="Chats" className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
        {(Object.keys(CHATS) as Chat[]).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={chat === id}
            onClick={() => open(id)}
            className="grid min-w-0 gap-0.5 rounded-lg border px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:border-primary/50 aria-selected:bg-accent"
          >
            <span className="text-sm font-medium">{CHATS[id].name}</span>
            {chat !== id && drafts[id] ? (
              <UnsentMarker variant="row" text={drafts[id].text} />
            ) : (
              <span className="truncate text-xs text-muted-foreground">{CHATS[id].last}</span>
            )}
          </button>
        ))}
      </div>
      {chat && <Thread key={chat} chat={chat} />}
    </div>
  )
}
