import { notFound } from "next/navigation"

import { demos } from "@/components/demo-index"
import { PreviewFrame } from "./preview-frame"

export function generateStaticParams() {
  // Pre-render the six homepage previews plus the headless integration demo.
  // Every other demo remains available and is generated on first request.
  const featured = new Set(["amount-input", "email-input", "phone-input", "password-input", "upi-id-input", "card-expiry-input", "use-bollard-field"])
  return demos.filter((demo) => featured.has(demo.name)).map((demo) => ({ name: demo.name }))
}

export default async function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!demos.some((demo) => demo.name === name)) notFound()
  return <PreviewFrame name={name} />
}
