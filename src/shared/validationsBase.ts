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
