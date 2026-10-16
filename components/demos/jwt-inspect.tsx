"use client"

import * as React from "react"

import { JwtInspect } from "@/registry/default/jwt-inspect/jwt-inspect"

// Fixed clock so the demo reads the same every time: 14 Oct 2026, 9:00 am IST.
const NOW = 1791948600000

// Demo tokens are built at load time from plain JSON, and every signature is the text
// "demo-signature-not-real". Nothing here is a real token, so secret scanners have nothing to flag.
const base64Url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const FAKE_SIGNATURE = base64Url("demo-signature-not-real")
const demoToken = (header: object, payload: object, signature = FAKE_SIGNATURE) => [base64Url(JSON.stringify(header)), base64Url(JSON.stringify(payload)), signature].join(".")

const ACME = { sub: "user_8231", iss: "https://auth.acme.dev", aud: "api.acme.dev" }
const RS = { alg: "RS256", kid: "2026-10" }
const GOOD = demoToken({ ...RS, typ: "JWT" }, { ...ACME, scope: "orders:read", iat: 1791947700, exp: 1791951300 })

const samples = [
  { name: "HS256 vs RS256", token: demoToken({ alg: "HS256", typ: "JWT" }, { sub: ACME.sub, iss: ACME.iss, email: "tushar@acme.dev", role: "admin", iat: 1789349400, exp: 1791941400 }) },
  { name: "alg none", token: demoToken({ alg: "none", typ: "JWT" }, { ...ACME, role: "admin", iat: 1791948540, exp: 1791952200 }, "") },
  { name: "Not yet valid", token: demoToken(RS, { ...ACME, nbf: 1791954000, iat: 1791948570, exp: 1791957600 }) },
  { name: "Milliseconds", token: demoToken(RS, { ...ACME, iat: 1791948540000, exp: 1791952200000 }) },
  { name: "Secrets inside", token: demoToken({ ...RS, jku: "https://evil.example/keys.json" }, { ...ACME, iat: 1791948540, exp: 1791949500, card: "4111 1111 1111 1111", password: "hunter2" }) },
  { name: "From curl", token: `curl -H "Authorization: Bearer ${GOOD}" https://api.acme.dev/orders` },
  { name: "Good token", token: `Bearer ${GOOD}` },
]

export function Demo() {
  const [value, setValue] = React.useState(samples[0].token)
  return (
    <div className="grid w-full max-w-xl gap-3">
      <JwtInspect value={value} onValueChange={setValue} algorithms={["RS256"]} audience="api.acme.dev" issuer="https://auth.acme.dev" now={NOW} timeZone="Asia/Kolkata" />
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Try a token">
        <span className="text-muted-foreground">Try:</span>
        {samples.map((sample) => (
          <button
            key={sample.name}
            type="button"
            aria-pressed={value === sample.token}
            onClick={() => setValue(sample.token)}
            className="h-7 rounded-md border px-2 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"
          >
            {sample.name}
          </button>
        ))}
      </div>
    </div>
  )
}
