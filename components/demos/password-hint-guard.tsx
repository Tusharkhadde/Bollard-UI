"use client"

import * as React from "react"

import { PasswordHintGuard } from "@/registry/default/password-hint-guard/password-hint-guard"

const presets = ["same as my Gmail", "ognob backwards", "my dog's name", "B-o-n-g-o 2019"]

export function Demo() {
  const [password, setPassword] = React.useState("Bongo@2019")
  const [hint, setHint] = React.useState("Bongo + the year we got him")
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-1.5">
        <label htmlFor="demo-new-password" className="text-sm font-medium">New password</label>
        <input
          id="demo-new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </div>
      <PasswordHintGuard password={password} value={hint} onValueChange={setHint} />
      <PasswordHintGuard password={password} kind="answer" label="What was your first pet's name?" defaultValue="bongo" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => setHint(p)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p}
          </button>
        ))}
      </div>
    </form>
  )
}
