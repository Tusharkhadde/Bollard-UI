"use client"

import * as React from "react"

import { TripDateChain, type TripLeg, type TripStay } from "@/registry/default/trip-date-chain/trip-date-chain"

// Mumbai → Singapore → Bali → Mumbai, booked across three sites. Landing at 00:50 with the Singapore room from that
// date, a night between Ubud and Seminyak with no bed, and the Seminyak room kept past a 00:35 departure.
const LEGS: TripLeg[] = [
  { id: "l1", label: "AI 2380 BOM → SIN", depart: "2026-11-12T16:50", arrive: "2026-11-13T00:50", departTz: "Asia/Kolkata", arriveTz: "Asia/Singapore" },
  { id: "l2", label: "SQ 942 SIN → DPS", depart: "2026-11-16T09:30", arrive: "2026-11-16T12:10", departTz: "Asia/Singapore", arriveTz: "Asia/Makassar" },
  { id: "l3", label: "6E 1602 DPS → BOM", depart: "2026-11-22T00:35", arrive: "2026-11-22T05:35", departTz: "Asia/Makassar", arriveTz: "Asia/Kolkata" },
]

const STAYS: TripStay[] = [
  { id: "s1", name: "Marina Bay hotel", checkIn: "2026-11-13", checkOut: "2026-11-16" },
  { id: "s2", name: "Ubud villa", checkIn: "2026-11-16", checkOut: "2026-11-19" },
  { id: "s3", name: "Seminyak stay", checkIn: "2026-11-20", checkOut: "2026-11-22" },
]

export function Demo() {
  return <TripDateChain legs={LEGS} defaultValue={STAYS} locale="en-GB" />
}
