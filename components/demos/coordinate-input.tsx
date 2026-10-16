"use client"

import { CoordinateInput } from "@/registry/default/coordinate-input/coordinate-input"

const pune = { lat: 18.5204, lon: 73.8567, radiusKm: 600, name: "Pune" }

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <CoordinateInput label="Warehouse location" expectedArea={pune} defaultValue="73.8567, 18.5204" />
      <CoordinateInput
        label="Pickup point"
        expectedArea={pune}
        defaultValue="https://www.google.com/maps/place/Shaniwar+Wada/@18.519,73.853,17z/data=!3m1!4b1!4m6!3m5!1s0x3bc2c06fa5b442ff:0x9df365f5b648bce1!8m2!3d18.5195694!4d73.8553467"
      />
      <CoordinateInput label="Drop point" expectedArea={pune} hint={`Try -18.5204, 73.8567 or 18°31'13"N 73°51'24"E.`} />
    </form>
  )
}
