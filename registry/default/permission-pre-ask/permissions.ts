// Bollard UI — permission-pre-ask · MIT licence · https://bollard-ui.vercel.app/components/permission-pre-ask

export type PermissionKind = "notifications" | "geolocation" | "camera" | "microphone"
/** "prompt" means the browser would still ask; "dismissed" means it asked and the user closed it. */
export type PermissionResult = "granted" | "denied" | "prompt" | "dismissed" | "unsupported" | "needs-install"
export type BrowserName = "chrome" | "edge" | "firefox" | "safari" | "ios" | "other"

export const PERMISSION_NOUNS: Record<PermissionKind, string> = {
  notifications: "Notifications",
  geolocation: "Location",
  camera: "Camera",
  microphone: "Microphone",
}

/** Which browser's settings to describe. Every iOS browser uses the iOS Settings app. */
export function detectBrowser(userAgent: string, maxTouchPoints = 0): BrowserName {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "ios"
  if (/Edg\//.test(userAgent)) return "edge"
  if (/Firefox\//.test(userAgent)) return "firefox"
  if (/Chrome\/|Chromium\//.test(userAgent)) return "chrome"
  if (/Safari\//.test(userAgent)) return "safari"
  return "other"
}

/** Where to turn a blocked permission back on, step by step, in this browser. */
export function reEnableSteps(browser: BrowserName, kind: PermissionKind): string[] {
  const noun = PERMISSION_NOUNS[kind]
  switch (browser) {
    case "chrome":
      return [`Click the site controls icon to the left of the address`, `Switch ${noun} on, or open Site settings and choose Allow`, "Reload this page"]
    case "edge":
      return ["Click the lock icon to the left of the address", "Choose Permissions for this site", `Set ${noun} to Allow, then reload`]
    case "firefox":
      return [`Click the crossed-out ${noun.toLowerCase()} icon in the address bar`, "Click × next to Blocked to clear it", "Reload and choose Allow"]
    case "safari":
      return ["In the menu bar choose Safari, then Settings, then Websites", `Pick ${noun} in the sidebar`, "Set this website to Allow, then reload"]
    case "ios":
      return kind === "notifications"
        ? ["Open the Settings app, then Notifications", "Find this web app in the list", "Turn on Allow Notifications"]
        : ["Tap the page menu (aA) in the address bar, then Website Settings", `Set ${noun} to Allow`, "Reload this page"]
    default:
      return ["Open this site's settings from the icon in the address bar", `Set ${noun} to Allow`, "Reload this page"]
  }
}

const QUERY_NAMES: Record<PermissionKind, string> = { notifications: "notifications", geolocation: "geolocation", camera: "camera", microphone: "microphone" }

/** Reads the current state without ever showing a prompt. */
export async function queryPermission(kind: PermissionKind): Promise<PermissionResult> {
  if (kind === "notifications" && !("Notification" in window)) {
    // iOS only exposes web notifications to sites added to the Home Screen.
    return detectBrowser(navigator.userAgent, navigator.maxTouchPoints) === "ios" ? "needs-install" : "unsupported"
  }
  if (kind === "geolocation" && !("geolocation" in navigator)) return "unsupported"
  if ((kind === "camera" || kind === "microphone") && !navigator.mediaDevices?.getUserMedia) return "unsupported"
  if (kind === "notifications") return Notification.permission === "default" ? "prompt" : Notification.permission
  try {
    return (await navigator.permissions.query({ name: QUERY_NAMES[kind] as PermissionName })).state
  } catch {
    return "prompt" // Older Firefox and Safari can't query camera; asking is the only way to know.
  }
}

/** Shows the browser's real prompt. Call only from a click. Streams opened to ask are stopped at once. */
export async function requestPermission(kind: PermissionKind): Promise<PermissionResult> {
  if (kind === "notifications") {
    const result = await Notification.requestPermission()
    return result === "default" ? "dismissed" : result
  }
  try {
    if (kind === "geolocation") {
      await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 60_000 }))
    } else {
      const stream = await navigator.mediaDevices.getUserMedia(kind === "camera" ? { video: true } : { audio: true })
      stream.getTracks().forEach((track) => track.stop())
    }
    return "granted"
  } catch (error) {
    // A closed prompt and a "Block" both reject; the permission state tells them apart.
    const state = await queryPermission(kind)
    if (state === "prompt") return "dismissed"
    if (state === "granted") return "granted" // Allowed, but e.g. no GPS fix yet.
    if (state === "denied" || (error as { code?: number; name?: string }).code === 1 || (error as { name?: string }).name === "NotAllowedError") return "denied"
    throw error
  }
}
