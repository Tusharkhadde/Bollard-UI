"use client"

import { ConnectionStringInput } from "@/registry/default/connection-string-input/connection-string-input"

export function Demo() {
  return <ConnectionStringInput environment="production" defaultValue={'DATABASE_URL="postgres://app:Tr0ub4dor@3#x@db.prod.example.com:5432/shop"'} />
}
