"use client"

import * as React from "react"

import { SaveStatus, useAutosave } from "@/registry/default/save-status/save-status"

const OFFLINE = "Saved on this device, will sync"

export function Demo() {
  const [text, setText] = React.useState("Quarterly update: revenue grew 12% and churn fell for the third month.")
  // On by default, so the first edit shows a real failure and a Retry instead of a fake "Saved".
  const [failNext, setFailNext] = React.useState(true)
  const failRef = React.useRef(failNext)
  React.useEffect(() => {
    failRef.current = failNext
  }, [failNext])

  const save = React.useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    if (failRef.current) {
      setFailNext(false)
      throw new Error("Server returned 503")
    }
  }, [])
  const { status, savedAt, error, retry } = useAutosave(text, save, { delay: 700, draftKey: "bollard-ui-demo-draft" })

  const [twoMinAgo, setTwoMinAgo] = React.useState<number>()
  React.useEffect(() => setTwoMinAgo(Date.now() - 2 * 60_000), [])

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="rounded-xl border bg-background">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-sm font-medium">Draft</span>
          <SaveStatus status={status} savedAt={savedAt} error={error} offlineLabel={OFFLINE} onRetry={() => void retry()} />
        </div>
        <textarea
          aria-label="Draft"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="block min-h-24 w-full resize-none rounded-b-xl bg-transparent p-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} />
        Make the next save fail. Type in the draft to try it.
      </label>
      <div className="grid gap-2 rounded-lg border border-dashed p-3" role="group" aria-label="Every state">
        <SaveStatus status="saving" />
        <SaveStatus status="saved" savedAt={twoMinAgo} />
        <SaveStatus status="offline" offlineLabel={OFFLINE} />
        <SaveStatus status="error" error="Server returned 503" onRetry={() => {}} />
      </div>
    </div>
  )
}
