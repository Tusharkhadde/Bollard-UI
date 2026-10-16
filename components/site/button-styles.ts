// Shared site button looks (landing + docs). Plain class strings so server components can use them on <Link>/<a>.
const base =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0"

/** Solid near-black (light) / near-white (dark) button. */
export const buttonPrimary = `${base} bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary/90`

/** Hairline outline button. */
export const buttonOutline = `${base} border bg-background hover:border-border-strong hover:bg-accent`

/** Text-only button / link with an arrow. */
export const buttonGhost = `${base} px-3 text-muted-foreground hover:bg-accent hover:text-foreground`
