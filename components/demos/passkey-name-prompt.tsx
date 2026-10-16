"use client"

import { PasskeyNamePrompt } from "@/registry/default/passkey-name-prompt/passkey-name-prompt"

const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"

export function Demo() {
  return (
    <PasskeyNamePrompt
      aaguid="adce0002-35bc-c60a-648b-0b25f1f05503"
      userAgent={MAC_CHROME}
      backupEligible={false}
      existingNames={["iCloud Keychain", "Mac · Chrome", "YubiKey 5C"]}
      defaultValue="Mac · Chrome"
      onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
      onSkip={() => {}}
    />
  )
}
