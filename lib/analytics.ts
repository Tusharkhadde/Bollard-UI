/** Browser-only, privacy-conscious event tracking for product adoption decisions. */
export function registryItemsFromArgs(args: string) {
  return [...new Set([...args.matchAll(/\/r\/([a-z0-9-]+)\.json\b/g)].map((match) => match[1]))]
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
