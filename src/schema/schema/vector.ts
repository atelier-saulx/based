import { assert, isNatural, isString } from './shared.js'
import { parseBase, type Base } from './base.js'

// TODO This should probably come from zigTsExports.ts
const vectorBaseTypes = [
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
  'float32',
  'float64',
] as const
type VectorBaseType = (typeof vectorBaseTypes)[number]
export const vectorBaseType2TypedArray = {
  int8: Int8Array,
  uint8: Uint8Array,
  int16: Int16Array,
  uint16: Uint16Array,
  int32: Int32Array,
  uint32: Uint32Array,
  float32: Float32Array,
  float64: Float64Array,
}
export type VectorBaseType2TypedArray = typeof vectorBaseType2TypedArray


export type SchemaVector<T extends VectorBaseType = VectorBaseType> = Base & {
  type: 'vector' | 'colvec'
  /**
   * Number of elements in the vector.
   */
  size: number
  /**
   * Base type of the vector.
   * float64 == number
   */
  baseType: T
 /**
  * Default vector.
  */
  default?: InstanceType<VectorBaseType2TypedArray[T]>
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
