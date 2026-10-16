"use client"

import * as React from "react"

import { UnansweredCheck, type ExamQuestion } from "@/registry/default/unanswered-check/unanswered-check"

const initial: ExamQuestion[] = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1
  return {
    id: `q${n}`,
    answered: [4, 9, 12, 15].includes(n) ? false : n === 7 ? "partial" : true,
    required: n !== 15,
    flagged: n === 3 || n === 9,
    note: n === 7 ? "1 of 2 chosen" : undefined,
  }
})

export function Demo() {
  const [questions, setQuestions] = React.useState(initial)
  const [endsAt, setEndsAt] = React.useState<number>()
  const [current, setCurrent] = React.useState<string>()
  const [submitted, setSubmitted] = React.useState(false)

  React.useEffect(() => setEndsAt(Date.now() + (4 * 60 + 12) * 1000), [])

  const answer = (id: string) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, answered: true, saving: true } : q)))
    setTimeout(() => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, saving: false } : q))), 900)
  }

  if (submitted) return <p className="text-sm font-medium">Submitted. You can close this tab.</p>
  return (
    <div className="grid w-full max-w-md gap-3">
      {current && (
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span>Question {current.slice(1)}</span>
          <button type="button" onClick={() => answer(current)} className="h-8 rounded-md border px-3 text-sm font-medium hover:bg-accent">
            Mark answered
          </button>
        </div>
      )}
      <UnansweredCheck
        questions={questions}
        endsAt={endsAt}
        onJump={setCurrent}
        onSubmit={() => new Promise<void>((resolve) => setTimeout(() => (setSubmitted(true), resolve()), 700))}
      />
    </div>
  )
}
