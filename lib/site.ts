// Site-wide constants with no Node imports, safe for the root layout and the OG image.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://bollard-ui.vercel.app").replace(/\/$/, "")

/**
 * The source repository is private for now. Every GitHub link on the site (header
 * icon, CTA, footer GitHub/README/License/issues) renders only when this is true;
 * otherwise the site points at its own pages and the feedback address below.
 * Flip to true when the repo goes public and the GitHub links come back.
 */
export const REPO_PUBLIC = false
export const REPO_URL = "https://github.com/Tusharkhadde/Bollard-UI"
/** @deprecated Use REPO_URL, and only when REPO_PUBLIC is true. */
export const GITHUB_URL = REPO_URL

export const CONTACT_EMAIL = "tusharkhadde06@gmail.com"
export const FEEDBACK_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Bollard UI feedback")}`
export const SECURITY_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Bollard UI security report")}`

export const TAGLINE = "Build interfaces your users can't break by accident."
export const LICENSE_LINE = "MIT licensed. Source copied into your project."
export const COMPAT = "React 19+ · Tailwind v4 · shadcn"

/** Where "read the docs / license / report an issue" goes, given the repo's visibility. */
export const links = {
  readme: REPO_PUBLIC ? `${REPO_URL}#readme` : "/docs",
  license: REPO_PUBLIC ? `${REPO_URL}/blob/main/LICENSE` : "/license",
  issues: REPO_PUBLIC ? `${REPO_URL}/issues` : FEEDBACK_HREF,
}
