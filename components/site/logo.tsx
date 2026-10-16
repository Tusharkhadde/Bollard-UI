import * as React from "react"
import Link from "next/link"

/**
 * Bollard UI mark: a lowercase b whose stem is a bollard, domed top and a
 * hazard-striped band, the post that stops a mistake before it lands.
 * `stripe` is the colour of the dark stripes (the tile behind the mark).
 */
export function LogoMark({ className, stripe = "var(--primary)" }: { className?: string; stripe?: string }) {
  const clip = React.useId()
  return (
    <svg viewBox="4 4.5 24 24" className={className} aria-hidden>
      <circle cx="18" cy="19.4" r="5.1" fill="none" stroke="currentColor" strokeWidth="4.3" />
      <path d="M8 26.6V8.4a2.4 2.4 0 0 1 4.8 0v18.2z" fill="currentColor" />
      <clipPath id={clip}>
        <rect x="8" y="9.6" width="4.8" height="4.4" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x="8" y="9.6" width="4.8" height="4.4" fill="#f59e0b" />
        <path d="M6 15l6-6.4h1.6l-6 6.4zM9 15l6-6.4h1.6l-6 6.4z" fill={stripe} />
      </g>
    </svg>
  )
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <LogoMark className="size-6" />
      </span>
      <span>Bollard UI</span>
    </Link>
  )
}
