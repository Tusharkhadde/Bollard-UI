"use client"

import { Readback } from "@/registry/default/readback/readback"

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-3">
      <Readback label="License key" value="8OB1-lZ5S-Q0I2-7KXM" />
      <Readback label="Wi-Fi password" value="Sl0th-l1ves-5ky" verbatim groupSize={[6, 6]} />
      <Readback label="Booking reference" value="K8O2ZB" groupSize={[3, 3]} showMode={false} />
    </div>
  )
}
