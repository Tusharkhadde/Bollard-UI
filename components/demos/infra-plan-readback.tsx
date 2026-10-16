"use client"

import * as React from "react"

import { InfraPlanReadback } from "@/registry/default/infra-plan-readback/infra-plan-readback"

// Trimmed `terraform show -json tfplan` output: renaming the database forces a replacement, and a bucket was
// deleted from the config while force_destroy is on.
const PLAN = {
  format_version: "1.2",
  applyable: true,
  errored: false,
  variables: { environment: { value: "production" } },
  resource_changes: [
    { address: "aws_ecs_service.api", mode: "managed", type: "aws_ecs_service", change: { actions: ["update"] } },
    {
      address: "aws_db_instance.orders",
      mode: "managed",
      type: "aws_db_instance",
      action_reason: "replace_because_cannot_update",
      change: {
        actions: ["delete", "create"],
        before: { identifier: "orders-db", skip_final_snapshot: true, deletion_protection: false },
        after: { identifier: "orders-primary" },
        replace_paths: [["identifier"]],
      },
    },
    { address: "aws_cloudwatch_log_group.api", mode: "managed", type: "aws_cloudwatch_log_group", change: { actions: ["create"], importing: { id: "/ecs/api" } } },
    {
      address: "aws_s3_bucket.invoice_uploads",
      mode: "managed",
      type: "aws_s3_bucket",
      action_reason: "delete_because_no_resource_config",
      change: { actions: ["delete"], before: { bucket: "acme-invoice-uploads", force_destroy: true } },
    },
    { address: "aws_iam_role_policy.api_s3", mode: "managed", type: "aws_iam_role_policy", change: { actions: ["create"] } },
    { address: "data.aws_caller_identity.current", mode: "data", type: "aws_caller_identity", change: { actions: ["read"] } },
  ],
}

export function Demo() {
  const [applied, setApplied] = React.useState(false)
  return (
    <div className="w-full max-w-lg space-y-2">
      <InfraPlanReadback plan={PLAN} workspace="prod-eu" onApply={() => new Promise<void>((resolve) => setTimeout(() => (setApplied(true), resolve()), 800))} />
      {applied && <p className="text-xs text-muted-foreground">Apply started for prod-eu.</p>}
    </div>
  )
}
