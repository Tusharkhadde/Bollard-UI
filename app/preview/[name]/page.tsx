import { notFound } from "next/navigation"

import { demos } from "@/components/demo-index"
import { PreviewFrame } from "./preview-frame"

export function generateStaticParams() {
  return demos.map((demo) => ({ name: demo.name }))
}

export default async function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!demos.some((demo) => demo.name === name)) notFound()
  return <PreviewFrame name={name} />
}
