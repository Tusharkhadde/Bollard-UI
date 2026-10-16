"use client"

import { StayLength } from "@/registry/default/stay-length/stay-length"

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-6">
      <StayLength defaultValue={{ start: "2026-11-02", end: "2026-11-08" }} />
      <StayLength
        mode="leave"
        defaultValue={{ start: "2026-11-21", end: "2026-11-27" }}
        holidays={[{ date: "2026-11-24", name: "Office holiday" }]}
      />
    </div>
  )
}
