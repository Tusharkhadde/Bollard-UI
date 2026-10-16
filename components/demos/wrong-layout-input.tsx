"use client"

import { WrongLayoutInput } from "@/registry/default/wrong-layout-input/wrong-layout-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <WrongLayoutInput label="Reply to Olga" defaultValue="Ghbdtn? rfr ltkf&" />
      <WrongLayoutInput label="Subject" defaultValue="एाल् ूपा गलनदगमा ूद्ोब" hint="Names, links and code like useState are left alone." />
    </form>
  )
}
