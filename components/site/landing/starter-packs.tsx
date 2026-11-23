"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Bot, ChevronDown, IndianRupee, OctagonAlert, Package, Wallet } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { CopyButton } from "@/components/site/copy-button"
import { trackCopyInstall, trackStarterPackCopy } from "@/lib/analytics"
import { cn } from "@/lib/utils"

import { shortInstall } from "./install-pill"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const PACKS = [
  ["fintech-pack", "Fintech", "Payments, transfers and high-stakes amounts.", ["amount-input", "duplicate-payment-guard", "bank-transfer-timing"], 4],
  ["agent-pack", "Agent", "Human-in-the-loop checks for AI actions.", ["agent-action-approve", "ai-paste-guard", "undo-toast"], 3],
  ["danger-zone-pack", "Danger zone", "Destructive changes with a recovery path.", ["danger-zone", "type-to-confirm", "account-deletion-readback"], 5],
  ["india-pack", "India", "India-aware IDs, payments and amounts.", ["phone-input", "aadhaar-input", "ifsc-input"], 6],
  ["checkout-pack", "Checkout", "A safer payment submit.", ["amount-input", "safe-submit", "duplicate-payment-guard"], 5],
  ["signup-login-pack", "Sign-up", "Catch account setup errors.", ["email-input", "password-input", "username-input"], 6],
  ["account-settings-pack", "Settings", "Review sensitive account changes.", ["email-change-guard", "session-list", "unsaved-changes-bar"], 5],
  ["forms-pack", "Forms", "Save drafts and catch errors.", ["draft-restore", "unsaved-changes-bar", "error-summary"], 6],
  ["messaging-pack", "Messaging", "Check what and where you send.", ["reply-all-guard", "recipient-check", "attachment-nudge"], 5],
  ["devtools-pack", "Dev tools", "Guard infrastructure actions.", ["environment-badge", "kube-context-guard", "force-push-confirm"], 6],
  ["scheduling-pack", "Scheduling", "Clarify dates and time zones.", ["unambiguous-date", "timezone-picker", "time-confirm"], 6],
] as const

type Pack = (typeof PACKS)[number]

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "fintech-pack": Wallet,
  "agent-pack": Bot,
  "danger-zone-pack": OctagonAlert,
  "india-pack": IndianRupee,
}

const FEATURED = 4

function PackCopy({ name, label, className }: { name: string; label: string; className?: string }) {
  return (
    <CopyButton
      value={shortInstall(name)}
      label={`Copy ${label} pack install command`}
      onCopy={() => {
        trackStarterPackCopy(name)
        trackCopyInstall({ component: name, surface: "starter-pack", alsoInstallClick: false })
      }}
      className={cn("h-8 shrink-0 px-2.5 text-[11px]", className)}
    >
      Copy
    </CopyButton>
  )
}

function FeaturedPack({ pack }: { pack: Pack }) {
  const [name, label, description, components, count] = pack
  const Icon = ICONS[name] ?? Package
  return (
    <div className="group flex h-full min-w-0 flex-col rounded-2xl border bg-card p-5 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-[0_20px_50px_-35px_rgb(0_0_0/0.45)]">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="grid size-9 place-items-center rounded-lg border bg-surface text-brand">
          <Icon className="size-4" />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{count} components</span>
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{label}</h3>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {components.map((c) => (
          <li key={c}>
            <Link
              href={`/components/${c}`}
              className="inline-flex h-6 items-center rounded-md border bg-surface px-1.5 font-mono text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {c}
            </Link>
          </li>
        ))}
        {count > components.length && <li className="inline-flex h-6 items-center px-1 font-mono text-[11px] text-muted-foreground">+{count - components.length}</li>}
      </ul>
      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2 border-t pt-4">
          <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted-foreground">
            <span aria-hidden className="text-brand">$ </span>
            {shortInstall(name).replace("npx ", "")}
          </code>
          <PackCopy name={name} label={label} />
        </div>
      </div>
    </div>
  )
}

/** Section 6: four featured packs, the other seven one click away. */
export function StarterPacks() {
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = React.useState(false)
  const featured = PACKS.slice(0, FEATURED)
  const rest = PACKS.slice(FEATURED)

  return (
    <Section id="starter-packs" labelledBy="starter-packs-heading">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Reveal>
          <SectionHeading id="starter-packs-heading" eyebrow="Starter packs" title="One command per workflow.">
            Each pack installs the related guards together. Start with one, then add pieces from the catalog.
          </SectionHeading>
        </Reveal>
      </div>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((pack, i) => (
          <Reveal as="li" key={pack[0]} delay={i * 0.06} className="min-w-0">
            <FeaturedPack pack={pack} />
          </Reveal>
        ))}
      </ul>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="more-starter-packs"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-4 text-sm font-medium outline-none transition-colors hover:border-border-strong hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {expanded ? "Show fewer" : `See all ${PACKS.length} packs`}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="more-starter-packs"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
              {rest.map(([name, label, description, components, count]) => (
                <li key={name} className="flex min-w-0 items-start justify-between gap-3 bg-background p-4 sm:p-5">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">{label}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                    <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                      {count} components · {components.join(", ")}
                    </p>
                  </div>
                  <PackCopy name={name} label={label} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Need a different mix?{" "}
              <Link href="/components" className="inline-flex items-center gap-0.5 font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                Build a custom pack <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  )
}
