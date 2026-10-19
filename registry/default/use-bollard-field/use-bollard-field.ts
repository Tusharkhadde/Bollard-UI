"use client"

// Bollard UI — use-bollard-field · MIT licence · https://bollard-ui.vercel.app/components/use-bollard-field

import * as React from "react"

import { createValidationRunner, getBollardAriaProps, type BollardValidator } from "./validation"
import type { BollardError } from "./error"

export { runBollardValidation } from "./validation"
export { getBollardAriaProps } from "./validation"
export { BollardError, toBollardError } from "./error"

export type { BollardValidator } from "./validation"
export type { BollardErrorOptions } from "./error"

export interface UseBollardFieldOptions<T> {
  /** The field's initial value. */
  initialValue: T
  /** Your validation logic. Sync functions and async checks are both supported. */
  validate: BollardValidator<T>
  /** Observe thrown validator failures (for logging or form-level recovery). */
  onError?: (error: BollardError) => void
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
  /** Merge existing hint IDs with Bollard's error ID: `ariaPropsFor(hintId)`. */
  ariaPropsFor: (describedBy?: string) => { "aria-invalid": true | undefined; "aria-describedby": string | undefined }
  /** Set a server-side error; it clears when the user edits the value. */
  setError: (message: string) => void
  clearError: () => void
  /** Restore the initial value, or provide a new one. */
  reset: (value?: T) => void
  /** Run validation immediately. Resolves true if valid. */
  validate: () => Promise<boolean>
}

/**
 * Validation state for any React control. Bollard UI controls, shadcn/ui
 * controls and custom controls can all connect through `value`, `setValue`
 * and `ariaProps`; this hook renders no UI and has no styling dependency.
 */
export function useBollardField<T>({ initialValue, validate, onError }: UseBollardFieldOptions<T>): BollardField<T> {
  const [value, setValueState] = React.useState(initialValue)
  const [error, setErrorState] = React.useState<string>()
  const [touched, setTouched] = React.useState(false)
  const [isValidating, setIsValidating] = React.useState(false)
  const valueRef = React.useRef(value)
  const [runner] = React.useState(() => createValidationRunner(validate, (state) => {
    if (state.isValidating !== undefined) setIsValidating(state.isValidating)
    if ("error" in state) setErrorState(state.error)
  }, onError))
  const id = React.useId()
  const errorId = `bollard-${id.replace(/:/g, "")}-error`

  React.useEffect(() => {
    runner.setValidator(validate)
  }, [runner, validate])

  React.useEffect(() => {
    runner.setOnError(onError)
  }, [runner, onError])

  React.useEffect(() => {
    valueRef.current = value
  }, [value])

  const setValue = React.useCallback((nextValue: T) => {
    runner.invalidate()
    valueRef.current = nextValue
    setValueState(nextValue)
    // A server/previous error shouldn't stick after the user changes the value.
    setErrorState(undefined)
    if (touched) void runner.validate(nextValue)
  }, [runner, touched])

  const onBlur = React.useCallback(() => {
    setTouched(true)
    void runner.validate(valueRef.current)
  }, [runner])

  const setError = React.useCallback((message: string) => {
    runner.invalidate()
    setIsValidating(false)
    setErrorState(message)
  }, [runner])

  const clearError = React.useCallback(() => {
    runner.invalidate()
    setIsValidating(false)
    setErrorState(undefined)
  }, [runner])

  const reset = React.useCallback((nextValue: T = initialValue) => {
    runner.invalidate()
    valueRef.current = nextValue
    setValueState(nextValue)
    setErrorState(undefined)
    setTouched(false)
    setIsValidating(false)
  }, [initialValue, runner])

  const invalid = Boolean(error)
  return {
    value,
    setValue,
    onBlur,
    error,
    invalid,
    isValidating,
    errorId,
    ariaProps: getBollardAriaProps(errorId, error),
    ariaPropsFor: (describedBy) => getBollardAriaProps(errorId, error, describedBy),
    setError,
    clearError,
    reset,
    validate: async () => !(await runner.validate(valueRef.current)),
  }
}
