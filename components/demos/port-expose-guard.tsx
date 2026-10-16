"use client"

import * as React from "react"

import { PortExposeGuard } from "@/registry/default/port-expose-guard/port-expose-guard"

const COMPOSE = `services:
  db:
    image: postgres:16
    ports:
      - 5432:5432
  cache:
    image: redis:7
    ports:
      - "6379:6380"
  web:
    image: nginx
    ports:
      - "80:80"`

export function Demo() {
  const [applied, setApplied] = React.useState(false)
  return (
    <div className="w-full max-w-lg space-y-2">
      <PortExposeGuard
        label="docker-compose.yml ports"
        defaultValue={COMPOSE}
        onValueChange={() => setApplied(false)}
        onApply={() => new Promise<void>((resolve) => setTimeout(() => { setApplied(true); resolve() }, 600))}
      />
      {applied && <p className="text-xs text-muted-foreground">Applied. docker compose up -d</p>}
    </div>
  )
}
