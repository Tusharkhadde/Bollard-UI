"use client"

import { YamlField } from "@/registry/default/yaml-field/yaml-field"

const config = `service: checkout
python: 3.10
regions: [GB, SE, NO]
ports:
  - 22:22
debug: off
service: payments`

export function Demo() {
  return <YamlField label="deploy.yaml" defaultValue={config} rows={7} className="max-w-sm" />
}
