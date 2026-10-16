"use client"

import { VersionRangeInput } from "@/registry/default/version-range-input/version-range-input"

const react = ["16.14.0", "17.0.2", "18.0.0", "18.2.0", "18.3.1", "19.0.0-rc.1", "19.0.0", "19.1.0"]
const tinySchema = ["0.1.4", "0.2.3", "0.2.5", "0.3.0", "0.4.1"]

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => event.preventDefault()}>
      <VersionRangeInput label="react" defaultValue="^18.2.0" versions={react} />
      <VersionRangeInput label="tiny-schema" defaultValue="^0.2.3" versions={tinySchema} />
    </form>
  )
}
