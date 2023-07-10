export const createError = (
  path: (number | string)[],
  fromType: string,
  fieldType: string,
  value: any,
  fieldDoesNotExist?: string,
  msg?: string
): Error => {
  const err = new Error()
  return new Error(
    `Type: "${fromType}" Field: "${path.join(
      '.'
    )}" is not a valid value for ${fieldType}`
  )
}
