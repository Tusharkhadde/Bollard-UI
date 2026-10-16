"use client"

import { RolePreview } from "@/registry/default/role-preview/role-preview"

const roles = [
  { id: "viewer", name: "Viewer", description: "Read only" },
  { id: "editor", name: "Editor", description: "Edit and comment" },
  { id: "admin", name: "Admin", description: "Full control" },
]

const capabilities = [
  { id: "view", label: "View projects and files" },
  { id: "comment", label: "Comment" },
  { id: "edit", label: "Edit projects" },
  { id: "invite", label: "Invite people", dangerous: true },
  { id: "delete", label: "Delete projects", dangerous: true },
  { id: "billing", label: "Manage billing", dangerous: true },
]

const matrix = {
  viewer: ["view", "comment"],
  editor: ["view", "comment", "edit"],
  admin: ["view", "comment", "edit", "invite", "delete", "billing"],
}

export function Demo() {
  return (
    <RolePreview
      roles={roles}
      capabilities={capabilities}
      matrix={matrix}
      defaultValue="admin"
      currentRole="viewer"
      personName="Priya"
      label="Priya's role in Acme Corp"
    />
  )
}
