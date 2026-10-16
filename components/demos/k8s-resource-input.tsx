"use client"

import { K8sResourceInput } from "@/registry/default/k8s-resource-input/k8s-resource-input"

export function Demo() {
  return <K8sResourceInput defaultValue={{ cpu: { request: "500", limit: "1" }, memory: { request: "1Gi", limit: "1G" } }} node={{ cpu: "3920m", memory: "15Gi" }} />
}
