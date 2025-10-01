import type { AppContext } from '../context/AppContext.js'

export const isNotEmpty = (value: string): boolean =>
  value !== '' && value !== undefined

export const isValidFunctionName = (value: string): boolean => {
  const functionNameRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/
  return functionNameRegex.test(value)
}

export const isValueInOptions =
  (options: { label: string; value: string }[]) =>
  (value: string): boolean =>
    options.findIndex((option) => option.value === value) > -1

export const isValueNotInOptions =
  (options: { label: string; value: string }[]) =>
  (value: string): boolean =>
    options?.length
      ? options.findIndex((option) => option.value === value) === -1
      : true

export const isFunctionsValid = <T extends string>(value: T): boolean =>
  value.split(',').every((element) => isValidFunctionName(element))

export const isEmailValid = (value: string): boolean => {
  const at: number = value.lastIndexOf('@')
  const dot: number = value.lastIndexOf('.')

  return at > 0 && at < dot - 1 && dot < value.length - 2
}

export const validationMessage =
  (errorMessage: AppContext['i18n'], option: string) =>
  (value: string | number) =>
    errorMessage('errors.901', option, value ?? '')
