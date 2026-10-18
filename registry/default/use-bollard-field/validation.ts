/** Return a message when a value is invalid, or nothing when it is valid. */
export type BollardValidator<T> = (value: T) => string | undefined | Promise<string | undefined>

export interface ValidationStateUpdate {
  error?: string
  isValidating: boolean
}

/** Merge Bollard's error relationship with IDs already used by a control. */
export function getBollardAriaProps(errorId: string, error?: string, describedBy?: string) {
  const ids = new Set((describedBy ?? "").split(/\s+/).filter(Boolean))
  if (error) ids.add(errorId)
  return {
    "aria-invalid": error ? true as const : undefined,
    "aria-describedby": ids.size ? [...ids].join(" ") : undefined,
  }
}

/** Normalize sync and async validators to one promise-based API. */
export async function runBollardValidation<T>(validator: BollardValidator<T>, value: T) {
  const message = await validator(value)
  return typeof message === "string" && message.trim() ? message : undefined
}

/**
 * Coordinates async field checks without React or UI dependencies. Only the
 * newest request may publish state; invalidating a request prevents stale
 * results from restoring an error after the user edits or resets the field.
 */
export function createValidationRunner<T>(validator: BollardValidator<T>, onState: (state: ValidationStateUpdate) => void) {
  let currentValidator = validator
  let requestId = 0

  return {
    setValidator(next: BollardValidator<T>) {
      currentValidator = next
      requestId += 1
      onState({ isValidating: false })
    },
    invalidate() {
      requestId += 1
      onState({ isValidating: false })
    },
    async validate(value: T) {
      const thisRequest = ++requestId
      onState({ isValidating: true })
      let error: string | undefined
      try {
        error = await runBollardValidation(currentValidator, value)
      } catch {
        error = "Unable to validate this value. Try again."
      }
      if (thisRequest === requestId) onState({ error, isValidating: false })
      return error
    },
  }
}
