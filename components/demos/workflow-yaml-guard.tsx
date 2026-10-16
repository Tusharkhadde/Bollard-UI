"use client"

import { WorkflowYamlGuard } from "@/registry/default/workflow-yaml-guard/workflow-yaml-guard"

const WORKFLOW = `name: Preview
on:
  pull_request_target:
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: echo "Building \${{ github.event.pull_request.title }}"
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}`

// Example SHAs standing in for a real lookup (GitHub API: GET /repos/{owner}/{repo}/commits/{ref}).
const SHAS: Record<string, string> = {
  "actions/checkout@v4": "08eba0b27e820071cde6df949e0beb9ba4906955",
  "peaceiris/actions-gh-pages@v4": "4f9cc6602d3f66b9c108549d475ec49e8ef4d45e",
}
const resolveSha = (action: string, ref: string) =>
  new Promise<string>((resolve, reject) => setTimeout(() => (SHAS[`${action}@${ref}`] ? resolve(SHAS[`${action}@${ref}`]) : reject(new Error("not found"))), 700))

export function Demo() {
  return <WorkflowYamlGuard label=".github/workflows/preview.yml" defaultValue={WORKFLOW} visibility="public" resolveSha={resolveSha} />
}
