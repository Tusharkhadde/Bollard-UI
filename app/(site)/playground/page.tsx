import type { Metadata } from "next"
import { SafetyPlayground } from "@/components/site/playground/safety-playground"

export const metadata: Metadata = {
  title: "Interactive safety playground",
  description: "Try common form mistakes against real Bollard UI components and see how clear validation and recovery states help.",
  alternates: { canonical: "/playground" },
  openGraph: { title: "Interactive safety playground · Bollard UI", description: "Try common form mistakes against real Bollard UI components and see how clear validation and recovery states help.", url: "/playground" },
}
export default function PlaygroundPage() { return <main className="px-4 py-8 sm:px-8 lg:px-10"><SafetyPlayground /></main> }
