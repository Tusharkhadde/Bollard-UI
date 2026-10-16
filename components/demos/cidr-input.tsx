"use client"

import { CidrInput } from "@/registry/default/cidr-input/cidr-input"

const existing = [
  { cidr: "10.0.0.0/16", label: "prod-vpc" },
  { cidr: "10.1.0.0/16", label: "staging-vpc" },
  { cidr: "2001:db8:1200::/40", label: "edge-v6" },
]

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <CidrInput label="New subnet" defaultValue="10.0.4.1/8" existing={existing} />
      <CidrInput label="SSH allowed from" defaultValue="0.0.0.0/0" />
      <CidrInput label="IPv6 block" defaultValue="2001:db8:1234::/48" existing={existing} />
    </form>
  )
}
