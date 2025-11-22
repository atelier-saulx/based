import { assert, isNatural, isRecord, isString } from './shared.js'
import { parseBase, type Base } from './base.js'
import { numberTypes } from './number.js'

const vectorBaseTypes = [...numberTypes, 'float32', 'float64'] as const

export type SchemaVector = Base & {
  type: 'vector' | 'colvec'
  /**
   * Number of elements in the vector.
   */
  size: number
  /**
   * Base type of the vector.
   * float64 == number
   */
  baseType?: (typeof vectorBaseTypes)[number]
}

export const parseVector = (def: Record<string, unknown>): SchemaVector => {
  assert(
    def.type === 'vector' || def.type === 'colvec',
    "Type should be one of 'vector' or 'colvec'",
  )
  assert(isNatural(def.size), 'Size should be natural number')
  assert(
    isString(def.baseType) && vectorBaseTypes.includes(def.baseType as any),
    'Invalid baseType',
  )

  return parseBase<SchemaVector>(def, {
    type: def.type,
    size: def.size,
    baseType: def.baseType as SchemaVector['baseType'],
  })
}
