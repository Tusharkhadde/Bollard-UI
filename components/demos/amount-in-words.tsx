"use client"

import * as React from "react"

import { AmountInWords } from "@/registry/default/amount-in-words/amount-in-words"

export function Demo() {
  // A rent deposit of ₹2,50,000 with the words written one place too high: on a cheque, the words win.
  const [words, setWords] = React.useState("Rupees Twenty Five Lakh Only")

  return <AmountInWords amount={250000} currency="INR" value={words} onValueChange={setWords} />
}
