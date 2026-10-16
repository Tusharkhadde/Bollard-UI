"use client"

import * as React from "react"

import { BranchTarget } from "@/registry/default/branch-target/branch-target"

const branches = [
  { name: "main", protected: true, ahead: 27, behind: 4 },
  { name: "develop", protected: true, ahead: 3, behind: 0 },
  { name: "release/2.4", protected: true, ahead: 9, behind: 2 },
  { name: "feature/otp-login", ahead: 0, behind: 0 },
]

export function Demo() {
  const [deployed, setDeployed] = React.useState(false)
  const [blocked, setBlocked] = React.useState(false)
  return (
    <div className="grid w-full max-w-md gap-6">
      <div className="grid gap-3">
        <BranchTarget
          head="feature/otp-login"
          branches={branches}
          defaultValue="main"
          forkedFrom="develop"
          headCommits={3}
          onIssuesChange={(_, { blocking }) => setBlocked(blocking)}
        />
        <button
          type="button"
          disabled={blocked}
          className="h-8 w-fit rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          Create pull request
        </button>
      </div>
      <BranchTarget
        mode="deploy"
        head="main"
        branches={[
          { name: "staging", ahead: 0, behind: 0 },
          { name: "production", protected: true, ahead: 6, behind: deployed ? 0 : 1 },
        ]}
        rules={[{ target: "production", from: ["main", "hotfix/*"] }]}
        defaultValue="production"
        onUpdate={() => new Promise<void>((resolve) => setTimeout(() => (setDeployed(true), resolve()), 600))}
      />
    </div>
  )
}
