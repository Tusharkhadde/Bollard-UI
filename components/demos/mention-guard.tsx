"use client"

import * as React from "react"

import { MentionGuard, type MentionContext, type MentionPerson } from "@/registry/default/mention-guard/mention-guard"

const AUDIENCES: MentionContext["audiences"] = {
  channel: { count: 1240, otherTimeZones: 300 },
  everyone: { count: 5400, otherTimeZones: 1900 },
  here: { count: 86, otherTimeZones: 12 },
  "design-team": { count: 42, otherTimeZones: 9 },
}
const PEOPLE: MentionPerson[] = [
  { handle: "priya", name: "Priya Sharma", inConversation: true },
  { handle: "rahul", name: "Rahul Mehta", inConversation: false },
  { handle: "dana", name: "Dana Reyes", inConversation: false, canAccess: false },
]

export function Demo() {
  const [people, setPeople] = React.useState(PEOPLE)
  const [sent, setSent] = React.useState<string>()
  const context = React.useMemo(() => ({ audiences: AUDIENCES, people }), [people])

  return (
    <div className="grid w-full max-w-md gap-3">
      <MentionGuard
        conversation="#launch"
        label="Reply in #launch"
        context={context}
        defaultValue="@channel the launch review moved to 4 pm IST. @rahul can you bring the deck?"
        onInvite={(person) => setPeople((list) => list.map((p) => (p.handle === person.handle ? { ...p, inConversation: true } : p)))}
        onSend={(text) => new Promise<void>((resolve) => setTimeout(() => (setSent(text), resolve()), 500))}
      />
      <p className="text-xs text-muted-foreground">
        {sent ? `Sent: “${sent}”` : "Try @here, @design-team, @dana or `@channel` in backticks."}
      </p>
    </div>
  )
}
