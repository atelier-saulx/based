export type OperandTypes =
  | 'string'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'symbol'
  | 'undefined'
  | 'object'
  | 'function'
  | 'array'
  | 'null'

export const getType = (item: any): OperandTypes => {
  return item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item
}
