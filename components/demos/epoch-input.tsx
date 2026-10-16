"use client"

import { EpochInput } from "@/registry/default/epoch-input/epoch-input"

export function Demo() {
  return <EpochInput label="Trial ends at (Unix seconds)" unit="s" defaultValue="1760400000000" timeZone="Asia/Kolkata" now={Date.UTC(2025, 9, 10)} />
}
