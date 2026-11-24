import { REPO_URL } from "@/lib/site"

type Repository = { stargazers_count?: unknown }

/**
 * The repository's star count, cached for a day (ISR). Null when GitHub is unreachable,
 * rate-limited or the repository is private, so callers can fall back to static copy.
 */
export async function fetchStarCount(): Promise<number | null> {
  try {
    const response = await fetch("https://api.github.com/repos/Tusharkhadde/Bollard-UI", {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(2_500),
    })
    if (!response.ok) return null
    const repository = await response.json() as Repository
    return typeof repository.stargazers_count === "number" && repository.stargazers_count >= 0 ? repository.stargazers_count : null
  } catch {
    return null
  }
}

/** Cached for a day; unavailable or private repositories simply omit the badge. */
export async function GitHubStars() {
  const starCount = await fetchStarCount()
  if (starCount === null) return null
  const count = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(starCount)
  return (
    <a href={REPO_URL} aria-label={`${starCount.toLocaleString()} GitHub stars`} className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span aria-hidden>★</span>{count}
    </a>
  )
}
