"use client"

import { ExternalLink } from "@/registry/default/external-link/external-link"

const links: { label: string; href: string; text: string; confirm?: "always" | "risky" }[] = [
  { label: "Safe", href: "https://docs.github.com/en/get-started", text: "GitHub docs" },
  { label: "Safe, risky-only", href: "https://react.dev/learn", text: "React docs", confirm: "risky" },
  { label: "Text vs href", href: "https://paypal-account-review.net/login", text: "paypal.com/signin" },
  { label: "Punycode", href: "https://xn--pypal-4ve.com/account", text: "Update billing" },
  { label: "Buried brand", href: "https://paypal.com.secure-verify.io/", text: "Verify your account" },
  { label: "Plain http", href: "http://example.org/download", text: "Download installer" },
]

export function Demo() {
  return (
    <div className="w-full max-w-md space-y-4">
      <ul className="flex flex-col gap-3 text-sm">
        {links.map((link) => (
          <li key={link.label} className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">{link.label}</span>
            <ExternalLink href={link.href} confirm={link.confirm}>
              {link.text}
            </ExternalLink>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Open any link: the first confirms where you&apos;re going, the risky-only one opens straight away, and the other four explain what&apos;s wrong first.
      </p>
    </div>
  )
}
