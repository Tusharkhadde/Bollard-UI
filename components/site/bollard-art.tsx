/** The bollard reduced to a glyph, sized to sit in a line of text. */
export function BollardGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 32" className={className} aria-hidden>
      <path d="M3.5 29V7.5a4.5 4.5 0 0 1 9 0V29z" fill="currentColor" />
      <rect x="3.5" y="10" width="9" height="5" fill="#f59e0b" />
      <rect x="1" y="28" width="14" height="3" rx="1.5" fill="currentColor" />
    </svg>
  )
}
