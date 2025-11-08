export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

export const isEmpty = (v: object) => Object.keys(v).length === 0
export const isString = (v: unknown): v is string => typeof v === 'string'
export const isNumber = (v: unknown): v is number => typeof v === 'number'
export const isInteger = (v: unknown): v is number =>
  isNumber(v) && Number.isSafeInteger(v)
export const isNatural = (v: unknown): v is number => isInteger(v) && v > 0

export function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) throw 'some error'
}

export type RequiredIfStrict<value, strict> = strict extends true
  ? value
  : value | undefined
