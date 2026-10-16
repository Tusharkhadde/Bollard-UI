"use client"

import * as React from "react"

import { ChatAudienceCheck, type ChatMember } from "@/registry/default/chat-audience-check/chat-audience-check"

const NOW = new Date("2026-10-14T13:30:00Z")

const MEMBERS: ChatMember[] = [
  { id: "me", name: "Neha Joshi", org: "Acme", isYou: true },
  { id: "m1", name: "Meera Iyer", org: "Acme" },
  { id: "m2", name: "Arjun Rao", org: "Acme" },
  { id: "m3", name: "Rohan Kapoor", savedAs: "Rahul Mehta", org: "Acme" },
  { id: "m4", name: "JG", joinedAt: "2026-10-12T09:10:00Z", addedBy: "Arjun" },
  { id: "m5", name: "Sana Qureshi", org: "Orbit Logistics", external: true },
  { id: "m6", name: "Dev Patel", org: "Acme" },
]

export function Demo() {
  const [members, setMembers] = React.useState(MEMBERS)
  const [log, setLog] = React.useState("")

  return (
    <div className="grid w-full max-w-md gap-2">
      <p className="text-xs font-medium">Launch core team</p>
      <ChatAudienceCheck
        conversation="Launch core team"
        organization="Acme"
        members={members}
        now={NOW}
        lastPostedAt="2026-10-11T12:00:00Z"
        defaultValue="Confidential: the launch date moves to 3 Nov. Please don't share outside this group."
        onRemove={(m) => new Promise<void>((resolve) => setTimeout(() => (setMembers((list) => list.filter((x) => x.id !== m.id)), resolve()), 400))}
        onViewProfile={(m) => setLog(`Opened ${m.name}'s profile.`)}
        onSend={(text) => new Promise<void>((resolve) => setTimeout(() => (setLog(`Sent: “${text}”`), resolve()), 500))}
      />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">{log}</p>
    </div>
  )
}
