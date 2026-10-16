"use client"

import * as React from "react"

import { KubeContextGuard } from "@/registry/default/kube-context-guard/kube-context-guard"

const MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
  labels:
    app: payments-api
spec:
  replicas: 3
---
apiVersion: v1
kind: Service
metadata:
  name: payments-api
`

const CONTEXTS = [
  { name: "staging-eu", cluster: "arn:aws:eks:eu-west-1:4821:cluster/staging-eu", namespace: "payments" },
  { name: "prod-eu", cluster: "arn:aws:eks:eu-west-1:4821:cluster/prod-eu-1" },
]

export function Demo() {
  const [ran, setRan] = React.useState("")
  return (
    <div className="w-full max-w-lg space-y-2">
      <KubeContextGuard
        // Someone ran `kubectl config use-context prod-eu` in another terminal since the last command.
        context={CONTEXTS[1]}
        contexts={CONTEXTS}
        lastRun={{ context: "staging-eu", namespace: "payments" }}
        defaultValue="kubectl apply -f payments-api.yaml"
        manifests={MANIFEST}
        expectedNamespace="payments"
        delay={0}
        onRun={(command) => new Promise<void>((resolve) => setTimeout(() => (setRan(command), resolve()), 700))}
      />
      {ran && <p className="text-xs [overflow-wrap:anywhere] text-muted-foreground">Ran: {ran}</p>}
    </div>
  )
}
