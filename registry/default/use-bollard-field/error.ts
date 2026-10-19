/** A dependency-free error shape for handling failures in Bollard integrations. */
export interface BollardErrorOptions extends ErrorOptions {
  code?: string
  retryable?: boolean
}

export class BollardError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(message: string, options: BollardErrorOptions = {}) {
    super(message, options)
    this.name = "BollardError"
    this.code = options.code ?? "UNEXPECTED_ERROR"
    this.retryable = options.retryable ?? false
  }
}

/** Keep a safe, stable field message while retaining the original failure for diagnostics. */
export function toBollardError(
  cause: unknown,
  message = "Field validation failed. Try again.",
): BollardError {
  if (cause instanceof BollardError) return cause
  return new BollardError(message, {
    code: "VALIDATION_FAILED",
    retryable: true,
    cause,
  })
}
