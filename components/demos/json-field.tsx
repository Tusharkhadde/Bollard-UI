"use client"

import { JsonField } from "@/registry/default/json-field/json-field"

const pasted = `{
  // copied from config.js
  name: 'checkout-api',
  "port": 8080,
  "regions": ["ap-south-1", "eu-west-1",],
}`

export function Demo() {
  return <JsonField label="Service config" defaultValue={pasted} rows={7} className="max-w-sm" />
}
