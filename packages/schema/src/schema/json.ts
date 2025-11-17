import { assert, isRecord } from './shared.ts'
import { parseBase, type Base } from './base.ts'

export type SchemaJson = Base & {
  type: 'json'
  default?: any
}

export const parseJson = (def: unknown): SchemaJson => {
  assert(isRecord(def))
  assert(def.type === 'json')

  return parseBase<SchemaJson>(def, {
    type: def.type,
    default: def.default,
  })
}
