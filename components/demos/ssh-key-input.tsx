"use client"

import * as React from "react"

import { decodeBase64, encodeBase64, SshKeyInput } from "@/registry/default/ssh-key-input/ssh-key-input"

// Demo fixtures only. The "private key" below is built at load time from a public key and a
// placeholder: it has the real openssh-key-v1 header (so the public half can be pulled out of it),
// but its private section is the text "DEMO FIXTURE - NOT A REAL PRIVATE KEY", so no scanner or
// person can mistake it for, or use it as, a working key.
const BLOB = "AAAAC3NzaC1lZDI1NTE5AAAAII4IL80I+F4/ls3GCQhPlgi6NO/A7hYGoSKri1WUeO8v"
function demoPrivateKey(publicBlob: string) {
  const text = (value: string) => new TextEncoder().encode(value)
  const field = (bytes: Uint8Array) => [new Uint8Array([0, 0, bytes.length >> 8, bytes.length & 255]), bytes]
  const parts = [text("openssh-key-v1\0"), ...field(text("none")), ...field(text("none")), ...field(new Uint8Array()), new Uint8Array([0, 0, 0, 1]), ...field(decodeBase64(publicBlob) ?? new Uint8Array()), ...field(text("DEMO FIXTURE - NOT A REAL PRIVATE KEY"))]
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  parts.reduce((offset, part) => (bytes.set(part, offset), offset + part.length), 0)
  const label = "OPENSSH PRIVATE KEY"
  return [`-----BEGIN ${label}-----`, ...(encodeBase64(bytes).match(/.{1,70}/g) ?? []), `-----END ${label}-----`].join("\n")
}
const DEMO_PRIVATE = demoPrivateKey(BLOB)
const LAPTOP = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMAb26KblxitspDTRnf4SntjmTdIYRC0Y/9KuR3Ps1qW"

const samples = [
  { name: "Private key", text: DEMO_PRIVATE },
  { name: "Wrapped", text: `ssh-ed25519 ${BLOB.slice(0, 34)}\n${BLOB.slice(34)} tushar@laptop` },
  { name: "No prefix", text: `${BLOB} tushar@laptop` },
  {
    name: "RSA 1024",
    text: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAgQC8/W9iDfIdMkzPCGmPAcqCRSQAlJ3iHLsEQV7/JXAxzbrRyUfhmxIpQjTzaa+ONtfrq/PG9ll2f3Ugv6R01JEwOjurxHs6PFZT1ASetjtH8SbuOEwdTwigORBSBdOomdhA0fsNG1TsubyXnglfSAk0hgQ7U99inrNf2jj0XQa4hw== old-server",
  },
  { name: "Already added", text: `${LAPTOP} tushar@macbook` },
  { name: "known_hosts", text: `github.com ${LAPTOP}` },
  { name: "SSH2 export", text: `---- BEGIN SSH2 PUBLIC KEY ----\nComment: "eddsa-key-20261014"\n${BLOB.slice(0, 40)}\n${BLOB.slice(40)}\n---- END SSH2 PUBLIC KEY ----` },
]

export function Demo() {
  const [value, setValue] = React.useState(DEMO_PRIVATE)
  return (
    <div className="grid w-full max-w-md gap-3">
      <SshKeyInput value={value} onValueChange={setValue} existing={[{ key: LAPTOP, label: "MacBook (added 3 Sep)" }]} />
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Try a paste">
        <span className="text-muted-foreground">Try:</span>
        {samples.map((sample) => (
          <button
            key={sample.name}
            type="button"
            aria-pressed={value === sample.text}
            onClick={() => setValue(sample.text)}
            className="h-7 rounded-md border px-2 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"
          >
            {sample.name}
          </button>
        ))}
      </div>
    </div>
  )
}
