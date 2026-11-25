// Site-wide constants with no Node imports, safe for the root layout and the OG image.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bollard-ui.vercel.app").replace(/\/$/, "")
export const SITE_NAME = "Bollard UI"
export const TWITTER_HANDLE = "@devtushark"
export const REPO_PUBLIC = true
export const REPO_URL = "https://github.com/Tusharkhadde/Bollard-UI"
export const GITHUB_URL = REPO_URL

/** Build a canonical absolute URL from a relative or absolute site path. */
export function absoluteUrl(path: string = ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`
}

export const ISSUES_URL = `${REPO_URL}/issues`
export const SECURITY_ADVISORIES_URL = `${REPO_URL}/security/advisories/new`
export const FEEDBACK_HREF = ISSUES_URL
export const SECURITY_HREF = SECURITY_ADVISORIES_URL

export const DISAMBIGUATING_DESCRIPTION =
  "Bollard UI is an independent open-source React component library for preventing user input mistakes, unrelated to physical bollards or other products with a similar name."

export const SAME_AS_PROFILES = [
  "https://github.com/Tusharkhadde",
  "https://github.com/Tusharkhadde/Bollard-UI",
  "https://x.com/devtushark",
]

export const TAGLINE = "shadcn React components for safer forms and risky actions."
export const LICENSE_LINE = "MIT licensed. Source copied into your project."
export const COMPAT = "React 19+ · Tailwind v4 · shadcn"

/** Where "read the docs / license / report an issue" goes, given the repo's visibility. */
export const links = {
  readme: REPO_PUBLIC ? `${REPO_URL}#readme` : "/docs",
  license: REPO_PUBLIC ? `${REPO_URL}/blob/main/LICENSE` : "/license",
  issues: REPO_PUBLIC ? `${REPO_URL}/issues` : FEEDBACK_HREF,
}
