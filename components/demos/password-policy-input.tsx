"use client"

import * as React from "react"

import { PasswordPolicyInput } from "@/registry/default/password-policy-input/password-policy-input"

export function Demo() {
  return (
    <PasswordPolicyInput
      // A typical inherited enterprise policy: every rule NIST SP 800-63B-4 now advises against.
      defaultValue={{
        minLength: 8, maxLength: 16, requireUppercase: true, requireLowercase: true, requireDigit: true, requireSymbol: true,
        expiryDays: 90, allowPaste: false, breachCheck: false, securityQuestions: true, passwordHints: false, mfaRequired: false, maxFailedAttempts: 0,
      }}
      onSave={() => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  )
}
