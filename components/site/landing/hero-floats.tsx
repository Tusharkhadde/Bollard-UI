"use client"

// Small live components floating around the hero window (wide screens only).
// Every animation here is transform or opacity, and the cards are absolutely
// positioned, so they never shift layout. Reduced motion: no bob, parallax or tilt.
import * as React from "react"
import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react"

import { cn } from "@/lib/utils"
import { AmountInput } from "@/registry/default/amount-input/amount-input"
import { EmailInput } from "@/registry/default/email-input/email-input"
import { PhoneInput } from "@/registry/default/phone-input/phone-input"
import { SecretPasteGuard } from "@/registry/default/secret-paste-guard/secret-paste-guard"

// A made-up Stripe-style key, split so secret scanners leave this file alone.
const fakeKey = ["sk_live", "_4eC39HqLyjWDarjtT1zdp7dc"].join("")

function EmailFloat() {
  return <EmailInput label="Email" defaultValue="ana@gmial.con" className="max-w-none" />
}

function AmountFloat() {
  const [rent, setRent] = React.useState<number | null>(250000)
  return <AmountInput label="Monthly rent" value={rent} onValueChange={setRent} typical={25000} words={false} className="max-w-none" />
}

function SecretFloat() {
  const [value, setValue] = React.useState(`STRIPE_KEY=${fakeKey}`)
  const id = React.useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Message to #general
      </label>
      <SecretPasteGuard value={value} onValueChange={setValue}>
        <input
          id={id}
          value={value}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </SecretPasteGuard>
    </div>
  )
}

function PhoneFloat() {
  return <PhoneInput label="Mobile" defaultValue="+91 +91 98765 43210" preferredCountries={["IN", "US", "GB"]} className="max-w-none" />
}

// Offsets: on 1280–1399px screens the cards tuck closer to the window; from 1400px they sit further out.
const FLOATS = [
  { name: "email-input", Demo: EmailFloat, place: "top-52 -left-12 min-[1400px]:-left-24", rotate: -4, parallax: -50, depth: 1, width: "w-60" },
  { name: "secret-paste-guard", Demo: SecretFloat, place: "top-28 -right-12 min-[1400px]:-right-24", rotate: 3.5, parallax: -80, depth: 1.3, width: "w-64" },
  { name: "amount-input", Demo: AmountFloat, place: "bottom-36 -left-14 min-[1400px]:-left-28", rotate: 3, parallax: -30, depth: 0.8, width: "w-64" },
  { name: "phone-input", Demo: PhoneFloat, place: "-bottom-4 -right-10 min-[1400px]:-right-20", rotate: -3, parallax: -60, depth: 1.1, width: "w-64" },
] as const

function FloatCard({
  index,
  float,
  scrollY,
  pointerX,
  pointerY,
  reduced,
}: {
  index: number
  float: (typeof FLOATS)[number]
  scrollY: MotionValue<number>
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  reduced: boolean
}) {
  const parallax = useTransform(scrollY, [0, 700], [0, reduced ? 0 : float.parallax])
  const rotateY = useTransform(pointerX, (v) => (reduced ? 0 : v * 7 * float.depth))
  const rotateX = useTransform(pointerY, (v) => (reduced ? 0 : -v * 7 * float.depth))
  const { Demo } = float

  return (
    <motion.div
      className={cn("pointer-events-auto absolute will-change-transform", float.place, float.width)}
      style={{ y: parallax, rotateX, rotateY, transformPerspective: 900 }}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 14 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        transition={reduced ? { duration: 0.2, delay: 0.5 } : { type: "spring", stiffness: 260, damping: 22, delay: 0.75 + index * 0.14 }}
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -7, 0, 6, 0] }}
          transition={reduced ? undefined : { duration: 7 + index * 0.9, repeat: Infinity, ease: "easeInOut", delay: 1.4 + index * 0.6 }}
        >
          <div
            style={{ rotate: `${float.rotate}deg` }}
            className="rounded-xl border bg-card p-4 text-card-foreground shadow-[0_18px_40px_-18px_rgb(0_0_0/0.35)] ring-1 ring-black/[0.03] dark:shadow-[0_18px_40px_-18px_rgb(0_0_0/0.8)] dark:ring-white/[0.04]"
          >
            <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
              {float.name}
            </div>
            <Demo />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function HeroFloats({
  scrollY,
  pointerX,
  pointerY,
  className,
}: {
  scrollY: MotionValue<number>
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  className?: string
}) {
  const reduced = !!useReducedMotion()
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <p className="sr-only">More live components, each catching a mistake:</p>
      {FLOATS.map((float, index) => (
        <FloatCard key={float.name} index={index} float={float} scrollY={scrollY} pointerX={pointerX} pointerY={pointerY} reduced={reduced} />
      ))}
    </div>
  )
}
