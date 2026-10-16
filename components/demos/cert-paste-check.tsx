"use client"

import * as React from "react"

import { base64ToBytes, CertPasteCheck, parseCertificate } from "@/registry/default/cert-paste-check/cert-paste-check"

// Throwaway demo PKI made for this page. Certificates are public by nature; the only key is built below.
const LEAF = [
  "-----BEGIN CERTIFICATE-----",
  "MIIB3zCCAYagAwIBAgIUFPw5BlvljGU1dsKKM5X+GoMFbSgwCgYIKoZIzj0EAwIw",
  "MTESMBAGA1UECgwJQWNtZSBEZW1vMRswGQYDVQQDDBJBY21lIERlbW8gVExTIENB",
  "IDEwHhcNMjYxMDEzMjEzOTI2WhcNMjYxMTAyMjEzOTI2WjAXMRUwEwYDVQQDDAx3",
  "d3cuYWNtZS5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARIXkEmdWd6ETF8",
  "tVYvFQ0Ly1NdEP0cesMtP5TL+brnG02aBO1RAGqRt6HahGXhv1R+Rf3CHK83yo1t",
  "4Pp6EIhco4GVMIGSMAkGA1UdEwQCMAAwIwYDVR0RBBwwGoIKKi5hY21lLmNvbYIM",
  "d3d3LmFjbWUuY29tMAsGA1UdDwQEAwIHgDATBgNVHSUEDDAKBggrBgEFBQcDATAd",
  "BgNVHQ4EFgQUg+JW2632oKgOaRiHHwrP/CcxcScwHwYDVR0jBBgwFoAUunHnxwT+",
  "p39MWB8zUa1FQDHqGRYwCgYIKoZIzj0EAwIDRwAwRAIgXnRK95t1u1+GwRkusjG7",
  "za9RoFGmxqfgP+2dV+VUC9ACIDtA+m8lPgdWL4P/+GYE/6fsHezS0fKKdVoGPepc",
  "N+XJ",
  "-----END CERTIFICATE-----",
].join("\n")
const INTERMEDIATE = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBwzCCAWmgAwIBAgIUNmPhwMeCdtioEkPHShOFhmQjL3MwCgYIKoZIzj0EAwIw",
  "LTESMBAGA1UECgwJQWNtZSBEZW1vMRcwFQYDVQQDDA5BY21lIERlbW8gUm9vdDAe",
  "Fw0yNjEwMTMyMTM5MjVaFw0zMTEwMTIyMTM5MjVaMDExEjAQBgNVBAoMCUFjbWUg",
  "RGVtbzEbMBkGA1UEAwwSQWNtZSBEZW1vIFRMUyBDQSAxMFkwEwYHKoZIzj0CAQYI",
  "KoZIzj0DAQcDQgAEfmv9fd7sUVT9JJD5AFJtroCCfCTqqbOT2YUkPFjHV4KWBZPr",
  "mFcCzR5+GVVRzUNCZoVAcis5WkCkn7CBV2sy/KNjMGEwDwYDVR0TAQH/BAUwAwEB",
  "/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFLpx58cE/qd/TFgfM1GtRUAx6hkW",
  "MB8GA1UdIwQYMBaAFNgFy+BQR527ehgWWWzQ8YtkoP87MAoGCCqGSM49BAMCA0gA",
  "MEUCIEnI0Y2ncTpNdRkei5fpE+a2wdZNeVirv3QAyYgfUxh1AiEA+757+FtOCEDq",
  "+Tp6U227otv7E7ypsnKWqPaBwXQ2e8w=",
  "-----END CERTIFICATE-----",
].join("\n")
// The demo "private key" is built at load time: a real PKCS#8 EC structure holding the leaf
// certificate's public point (so the key-match check has something true to match), but its
// private scalar is the text "DEMO-FIXTURE-NOT-A-REAL-KEY-0000". It can't sign anything and no
// scanner can mistake it for a live key.
function demoKeyFor(certificatePem: string) {
  const der = base64ToBytes(certificatePem.replace(/-----[A-Z ]+-----/g, "")) ?? new Uint8Array()
  const point = parseCertificate(der).publicKey?.replace(/^ec:/, "") ?? ""
  const scalar = Array.from(new TextEncoder().encode("DEMO-FIXTURE-NOT-A-REAL-KEY-0000"), (byte) => byte.toString(16).padStart(2, "0")).join("")
  const hex = `308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420${scalar}a144034200${point}`
  const bytes = String.fromCharCode(...(hex.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)))
  const label = "PRIVATE KEY"
  return [`-----BEGIN ${label}-----`, ...(btoa(bytes).match(/.{1,64}/g) ?? []), `-----END ${label}-----`].join("\n")
}
const LEAF_KEY = demoKeyFor(LEAF)
const CSR = [
  "-----BEGIN CERTIFICATE REQUEST-----",
  "MIIBCTCBrwIBADAXMRUwEwYDVQQDDAx3d3cuYWNtZS5jb20wWTATBgcqhkjOPQIB",
  "BggqhkjOPQMBBwNCAARIXkEmdWd6ETF8tVYvFQ0Ly1NdEP0cesMtP5TL+brnG02a",
  "BO1RAGqRt6HahGXhv1R+Rf3CHK83yo1t4Pp6EIhcoDYwNAYJKoZIhvcNAQkOMScw",
  "JTAjBgNVHREEHDAaggoqLmFjbWUuY29tggx3d3cuYWNtZS5jb20wCgYIKoZIzj0E",
  "AwIDSQAwRgIhAIL31uFYm9bdFMc7ztXr29utNRdEzFDsfCq8TTE30DdvAiEAyItO",
  "1ekZR16mV0zXi55aYKu26d+t9CPzPmHoAjUcqO0=",
  "-----END CERTIFICATE REQUEST-----",
].join("\n")
const SELF_SIGNED = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBkjCCATmgAwIBAgIUA8QP9LaDmBYT5YO9IJ0hfDXJB8QwCgYIKoZIzj0EAwIw",
  "FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI1MDEwMTAwMDAwMFoXDTI1MTIzMTAw",
  "MDAwMFowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D",
  "AQcDQgAE5wNrj5DNw83i1TQQG2YEObPfn1S7pCpqW9dSVeOdTjXg2Q/gpE7CvJQz",
  "3x5cvIURtMmbOEUo2oP0yGhYhXZwlKNpMGcwHQYDVR0OBBYEFDRto7OdPPuZpleP",
  "jINRs49UUJQOMB8GA1UdIwQYMBaAFDRto7OdPPuZplePjINRs49UUJQOMA8GA1Ud",
  "EwEB/wQFMAMBAf8wFAYDVR0RBA0wC4IJbG9jYWxob3N0MAoGCCqGSM49BAMCA0cA",
  "MEQCIHNpR3PM+3MamDrwRVHe5dGYzDBnPxfvFqeQ3EAjg+oOAiBPSEVtuco5D88z",
  "tpO4oT0EiPHFvxgAosApug1Waopu9A==",
  "-----END CERTIFICATE-----",
].join("\n")
// Fixed clock so the demo reads the same every time: 14 Oct 2026, 9:00 am IST.
const NOW = Date.UTC(2026, 9, 14, 3, 30)

const samples = [
  { name: "Out of order", text: `${INTERMEDIATE}\n${LEAF}\n`, hostname: "acme.com" },
  { name: "Key pasted", text: `${LEAF}\n${LEAF_KEY}\n${INTERMEDIATE}\n`, hostname: "www.acme.com" },
  { name: "CSR", text: `${CSR}\n`, hostname: "www.acme.com" },
  { name: "Self-signed", text: `${SELF_SIGNED}\n`, hostname: "localhost" },
  { name: "No PEM lines", text: LEAF.split("\n").slice(1, -1).join(""), hostname: "www.acme.com" },
  { name: "From JSON", text: JSON.stringify(`${LEAF}\n${INTERMEDIATE}\n`), hostname: "www.acme.com" },
  { name: "Renew soon", text: `${LEAF}\n${INTERMEDIATE}\n`, hostname: "shop.acme.com" },
]

export function Demo() {
  const [value, setValue] = React.useState(samples[0].text)
  const [hostname, setHostname] = React.useState(samples[0].hostname)
  return (
    <div className="grid w-full max-w-xl gap-3">
      <CertPasteCheck value={value} onValueChange={setValue} hostname={hostname} privateKey={LEAF_KEY} production now={NOW} timeZone="Asia/Kolkata" />
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Try a paste">
        <span className="text-muted-foreground">Try:</span>
        {samples.map((sample) => (
          <button
            key={sample.name}
            type="button"
            aria-pressed={value === sample.text}
            onClick={() => {
              setValue(sample.text)
              setHostname(sample.hostname)
            }}
            className="h-7 rounded-md border px-2 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"
          >
            {sample.name}
          </button>
        ))}
      </div>
    </div>
  )
}
