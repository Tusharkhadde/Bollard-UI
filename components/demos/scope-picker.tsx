"use client"

import { ScopePicker, type ScopeDef } from "@/registry/default/scope-picker/scope-picker"

const scopes: ScopeDef[] = [
  { id: "contents:read", title: "Read code", does: "read code and commits", access: "read" },
  { id: "contents:write", title: "Push code", does: "push commits", access: "write", implies: ["contents:read"] },
  { id: "pull_requests:read", title: "Read pull requests", does: "read pull requests", access: "read" },
  { id: "issues:write", title: "Manage issues", does: "open and close issues", access: "write" },
  { id: "admin:repo", title: "Repository settings", does: "change settings and access", access: "admin" },
  { id: "delete_repo", title: "Delete repositories", does: "delete repositories", access: "delete" },
]

export function Demo() {
  return (
    <ScopePicker
      label="Permissions for the deploy bot key"
      scopes={scopes}
      defaultValue={{ scopes: ["contents:write", "pull_requests:read", "issues:write", "admin:repo", "delete_repo"], expiresInDays: null }}
      used={["contents:read", "pull_requests:read", "issues:write"]}
    />
  )
}
