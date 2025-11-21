export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

export const isEmpty = (v: object) => Object.keys(v).length === 0
export const isString = (v: unknown): v is string => typeof v === 'string'
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
export const isFunction = (v: unknown): v is Function => typeof v === 'function'
export const isNumber = (v: unknown): v is number => typeof v === 'number'
export const isInteger = (v: unknown): v is number =>
  isNumber(v) && Number.isSafeInteger(v)
export const isNatural = (v: unknown): v is number => isInteger(v) && v > 0

export function assert(
  condition: unknown,
  msg: string | [obj: Record<string, unknown>, key: string, msg: string],
): asserts condition {
  if (!condition) throw msg
}

export type RequiredIfStrict<T, strict> = strict extends true ? T : Partial<T>

export const deleteUndefined = <P extends Record<string, unknown>>(
  obj: P,
): P => {
  for (const key in obj) {
    if (obj[key] === undefined) {
      delete obj[key]
    }
  }
  return obj
}
