"use client"

import { EmailInput } from "@/registry/default/email-input/email-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <EmailInput label="Work email" defaultValue="priya.sharma@gmial.con" />
      <EmailInput label="Personal email" placeholder="rahul@rediffmial.com" hint="Type rahul@ho to see providers, or a typo like yaho.com." />
    </form>
  )
}
