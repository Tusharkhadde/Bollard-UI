// Bollard UI — use-bollard-field · MIT licence · https://bollard-ui.vercel.app/components/use-bollard-field
import * as React from "react"

/** Return a message when a value is invalid, or nothing when it is valid. */
export type BollardValidator<T> = (value: T) => string | undefined | Promise<string | undefined>

export interface UseBollardFieldOptions<T> {
  /** The field's initial value. */
  initialValue: T
  /** Your validation logic. Sync functions and async checks are both supported. */
  validate: BollardValidator<T>
}

export interface BollardField<T> {
  value: T
  /** Connect this to a control's onValueChange, onChange, or equivalent callback. */
  setValue: (value: T) => void
  /** Validate on blur and reveal the inline error. */
  onBlur: () => void
  error: string | undefined
  invalid: boolean
  isValidating: boolean
  errorId: string
  /** Spread onto the control to connect its accessible error state. */
  ariaProps: { "aria-invalid": true | undefined; "aria-describedby": string | undefined }
  /** Set a server-side error; it clears when the user edits the value. */
  setError: (message: string) => void
  clearError: () => void
  /** Restore the initial value, or provide a new one. */
  reset: (value?: T) => void
  /** Run validation immediately. Resolves true if valid. */
  validate: () => Promise<boolean>
}

/** Normalize custom sync/async validation to one promise-based API. */
export async function runBollardValidation<T>(validator: BollardValidator<T>, value: T) {
  const message = await validator(value)
  return typeof message === "string" && message.trim() ? message : undefined
}

/**
 * Validation state for any React control. Bollard UI controls, shadcn/ui
 * controls and custom controls can all connect through `value`, `setValue`
 * and `ariaProps`; this hook renders no UI and has no styling dependency.
 */
export function useBollardField<T>({ initialValue, validate }: UseBollardFieldOptions<T>): BollardField<T> {
  const [value, setValueState] = React.useState(initialValue)
  const [error, setErrorState] = React.useState<string>()
  const [touched, setTouched] = React.useState(false)
  const [isValidating, setIsValidating] = React.useState(false)
  const validateRef = React.useRef(validate)
  const valueRef = React.useRef(value)
  const requestId = React.useRef(0)
  const id = React.useId()
  const errorId = `bollard-${id.replace(/:/g, "")}-error`

  React.useEffect(() => {
    validateRef.current = validate
  }, [validate])

  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  const validateValue = React.useCallback(async (nextValue: T) => {
    const currentRequest = ++requestId.current
    setIsValidating(true)
    try {
      const message = await runBollardValidation(validateRef.current, nextValue)
      if (currentRequest === requestId.current) setErrorState(message)
      return message
    } catch {
      const message = "Unable to validate this value. Try again."
      if (currentRequest === requestId.current) setErrorState(message)
      return message
    } finally {
      if (currentRequest === requestId.current) setIsValidating(false)
    }
  }, [])

  const setValue = React.useCallback((nextValue: T) => {
    requestId.current += 1
    valueRef.current = nextValue
    setValueState(nextValue)
    // A server/previous error shouldn't stick after the user changes the value.
    setErrorState(undefined)
    if (touched) void validateValue(nextValue)
  }, [touched, validateValue])

  const onBlur = React.useCallback(() => {
    setTouched(true)
    void validateValue(valueRef.current)
  }, [validateValue])

  const setError = React.useCallback((message: string) => {
    requestId.current += 1
    setIsValidating(false)
    setErrorState(message)
  }, [])

  const clearError = React.useCallback(() => {
    requestId.current += 1
    setIsValidating(false)
    setErrorState(undefined)
  }, [])

  const reset = React.useCallback((nextValue: T = initialValue) => {
    requestId.current += 1
    valueRef.current = nextValue
    setValueState(nextValue)
    setErrorState(undefined)
    setTouched(false)
    setIsValidating(false)
  }, [initialValue])

  const invalid = Boolean(error)
  return {
    value,
    setValue,
    onBlur,
    error,
    invalid,
    isValidating,
    errorId,
    ariaProps: { "aria-invalid": invalid || undefined, "aria-describedby": invalid ? errorId : undefined },
    setError,
    clearError,
    reset,
    validate: async () => !(await validateValue(valueRef.current)),
  }
}
