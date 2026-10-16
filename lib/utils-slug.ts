/** Client-safe slug: "Inputs that catch typos" → "inputs-that-catch-typos". Matches lib/catalog's slugify. */
export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
