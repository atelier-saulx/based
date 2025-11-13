import { assert, isNatural, isRecord, isString } from '../shared.js'
import { parseBase, type Base } from './base.js'
import { numberTypes } from './number.js'

const vectorBaseTypes = [...numberTypes, 'float32', 'float64']

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

export const parseVector = (def: unknown): SchemaVector => {
  assert(isRecord(def))
  assert(def.type === 'vector' || def.type === 'colvec')
  assert(isNatural(def.size))
  assert(isString(def.baseType) && vectorBaseTypes.includes(def.baseType))

  return parseBase<SchemaVector>(def, {
    type: def.type,
    size: def.size,
    baseType: def.baseType,
  })
}
