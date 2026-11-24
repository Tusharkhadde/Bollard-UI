/** Browser-only, privacy-conscious event tracking for product adoption decisions. */

declare global {
  interface Window {
    gtag?: (command: "event", event: string, parameters?: Record<string, string | string[] | boolean | undefined>) => void
  }
}

/** No-op unless GA4 has loaded and exposed gtag; never throws into caller code. */
function track(event: string, parameters: Record<string, string | string[] | undefined>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  window.gtag("event", event, parameters)
}

/** Extract public registry item names from an install command; nothing else is read. */
export function registryItemsFromArgs(args: string) {
  return [...new Set([...args.matchAll(/(?:\/r\/|@bollard\/)([a-z0-9-]+)(?:\.json)?\b/g)].map((match) => match[1]))]
}

export type InstallClickEvent = {
  component?: string
  components?: string[]
  surface: string
  packageManager?: string
}

/**
 * Track an install-command copy (`install_click`). Command text and visitor-entered
 * values are never sent; events contain only public component identifiers.
 */
export function trackInstallCopy({ component, components, surface, packageManager }: InstallClickEvent) {
  track("install_click", {
    component,
    components,
    surface,
    package_manager: packageManager,
  })
}

/** Starter packs copy install commands too; only the public pack identifier is sent. */
export function trackStarterPackCopy(pack: string) {
  track("install_click", { component: pack, surface: "starter-pack" })
}

/** Track a component or snippet copy (`copy_code`). Public file names only, never file contents. */
export function trackCopyCode({ component, file, surface }: { component?: string; file?: string; surface: string }) {
  track("copy_code", { component, file, surface })
}

/** Track a click on a GitHub link (`github_click`). Public URL and link label only. */
export function trackGithubClick({ url, label }: { url: string; label?: string }) {
  track("github_click", { link_url: url, link_label: label })
}

/** Track a click through to the documentation (`docs_visit`). Public path and link label only. */
export function trackDocsVisit({ path, label }: { path: string; label?: string }) {
  track("docs_visit", { link_path: path, link_label: label })
}

/** Track which public use-case path a visitor intentionally opens. */
export function trackUseCaseSelected({ useCase, surface }: { useCase: string; surface: string }) {
  track("bollard_use_case_selected", { use_case: useCase, surface })
}

/** Anonymous binary usefulness signal; never accepts free text or user-entered values. */
export function trackComponentFeedback({ component, helpful }: { component: string; helpful: boolean }) {
  track("bollard_component_feedback", { component, helpful: helpful ? "yes" : "no" })
}

/* ---------- Homepage engagement (landing redesign) ----------
 * Every event below carries only fixed, public identifiers (scene ids, component
 * slugs, CTA names). Nothing a visitor types is ever passed in or sent.
 */

/** The hero demo moved to another scene, by autoplay, a tab press or the Play button. */
export function trackHeroSceneChange({ scene, trigger }: { scene: string; trigger: "auto" | "tab" | "play" }) {
  track("hero_scene_change", { scene, trigger })
}

/** A visitor opened a tab in the homepage "Try to break it" playground. */
export function trackPlaygroundTab({ component }: { component: string }) {
  track("playground_tab", { component })
}

/** A guard visibly caught a mistake the visitor made. Only the component slug is sent, never the value. */
export function trackMistakeCaught({ component, surface }: { component: string; surface: string }) {
  track("mistake_caught", { component, surface })
}

/**
 * An install command was copied from a landing surface (`copy_install`). By default it also
 * records the long-standing `install_click`, so existing adoption reports keep counting copies.
 */
export function trackCopyInstall({ component, surface, alsoInstallClick = true }: { component: string; surface: string; alsoInstallClick?: boolean }) {
  track("copy_install", { component, surface })
  if (alsoInstallClick) trackInstallCopy({ component, surface })
}

/** A primary call to action on the homepage was pressed. `cta` is a fixed name, `surface` the section. */
export function trackCtaClick({ cta, surface }: { cta: string; surface: string }) {
  track("cta_click", { cta, surface })
}
