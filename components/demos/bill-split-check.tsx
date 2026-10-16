"use client"

import * as React from "react"

import { BillSplitCheck, type Receipt, type SplitValue } from "@/registry/default/bill-split-check/bill-split-check"

// Dinner for four in Pune. Meera paid. The bill already carries a 10% service charge, someone typed a ₹200 tip
// on top, nobody has claimed the jeera rice yet, and Priya only had dal and a lassi.
const RECEIPT: Receipt = {
  items: [
    { id: "paneer", name: "Paneer tikka", price: 340 },
    { id: "chicken", name: "Butter chicken", price: 460 },
    { id: "dal", name: "Dal makhani", price: 300 },
    { id: "naan", name: "Garlic naan", price: 240, qty: 4 },
    { id: "rice", name: "Jeera rice", price: 220 },
    { id: "lassi", name: "Mango lassi", price: 180, qty: 2 },
  ],
  taxes: [
    { label: "CGST 2.5%", amount: 43.5 },
    { label: "SGST 2.5%", amount: 43.5 },
  ],
  serviceCharge: 174,
  total: 2001,
}

const PEOPLE = [
  { id: "meera", name: "Meera" },
  { id: "aarav", name: "Aarav" },
  { id: "priya", name: "Priya" },
  { id: "kabir", name: "Kabir" },
]

const START: Partial<SplitValue> = {
  tip: 200,
  claims: {
    paneer: ["meera", "aarav", "kabir"],
    chicken: ["aarav", "kabir"],
    dal: ["priya", "meera"],
    naan: ["meera", "aarav", "kabir"],
    lassi: ["priya", "meera"],
  },
}

export function Demo() {
  return <BillSplitCheck receipt={RECEIPT} people={PEOPLE} payerId="meera" currency="INR" locale="en-IN" defaultValue={START} />
}
