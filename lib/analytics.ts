/** Browser-only, privacy-conscious event tracking for product adoption decisions. */
export function registryItemsFromArgs(args: string) {
  return [...new Set([...args.matchAll(/(?:\/r\/|@bollard\/)([a-z0-9-]+)(?:\.json)?\b/g)].map((match) => match[1]))]
}

type InstallCopyEvent = {
  component?: string
  components?: string[]
  surface: string
  packageManager?: string
}

declare global {
  interface Window {
    gtag?: (command: "event", event: string, parameters: Record<string, string | string[] | undefined>) => void
  }
}

/**
 * Track an intentional install-command copy. Command text and visitor-entered
 * values are never sent; events contain only public component identifiers.
 */
export function trackInstallCopy({ component, components, surface, packageManager }: InstallCopyEvent) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  window.gtag("event", "bollard_install_command_copied", {
    component,
    components,
    surface,
    package_manager: packageManager,
  })
}

function track(event: string, parameters: Record<string, string>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  window.gtag("event", event, parameters)
}

/** Track a public starter-pack identifier only; no copied command or visitor data is sent. */
export function trackStarterPackCopy(pack: string) {
  track("bollard_starter_pack_copied", { pack })
}

/** Track which public use-case path a visitor intentionally opens. */
export function trackUseCaseSelected({ useCase, surface }: { useCase: string; surface: string }) {
  track("bollard_use_case_selected", { use_case: useCase, surface })
}

/** Anonymous binary usefulness signal; never accepts free text or user-entered values. */
export function trackComponentFeedback({ component, helpful }: { component: string; helpful: boolean }) {
  track("bollard_component_feedback", { component, helpful: helpful ? "yes" : "no" })
}
