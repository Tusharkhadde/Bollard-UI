import type { Metadata } from "next"
import { SafetyPlayground } from "@/components/site/playground/safety-playground"

export const metadata: Metadata = { title: "Break this form", description: "Try common mistakes against real Bollard UI components." }
export default function PlaygroundPage() { return <main className="px-4 py-8 sm:px-8 lg:px-10"><SafetyPlayground /></main> }
