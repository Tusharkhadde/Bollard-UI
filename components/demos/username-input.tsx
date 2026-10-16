"use client"

import { UsernameInput } from "@/registry/default/username-input/username-input"

const verified = ["priya.sharma", "acme", "rahul.dev"]
const taken = new Set([...verified, "rahul.dev_", "rahuldev", "rahul.dev.in"])

// Stands in for a server call. Module scope keeps it stable between renders.
const checkAvailability = (handle: string) =>
  new Promise<boolean>((resolve) => setTimeout(() => resolve(!taken.has(handle)), 150))

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => event.preventDefault()}>
      <UsernameInput label="Username" defaultValue="Pr1ya_Sharma" existing={verified} checkAvailability={checkAvailability} />
      <UsernameInput label="Pick a handle" defaultValue="Rahul.Dev" placeholder="your.name" checkAvailability={checkAvailability} delay={250} />
    </form>
  )
}
