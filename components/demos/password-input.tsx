"use client"

import { PasswordInput } from "@/registry/default/password-input/password-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      {/* "Spring2026" typed with the keyboard still on a Russian layout. */}
      <PasswordInput label="Password" defaultValue="Ызкштп2026" />
      <PasswordInput
        label="Wi-Fi password"
        autoComplete="off"
        placeholder="Paste ' hunter2 ' or turn on Caps Lock"
        peek="toggle"
        hint="The eye toggles here. On the first field, press and hold it to peek."
      />
    </form>
  )
}
