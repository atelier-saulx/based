import { assert, isNatural, isString } from './shared.js'
import { parseBase, type Base } from './base.js'
import { VectorBaseType } from '../../zigTsExports.js'

const vectorBaseTypes = Object.keys(
  VectorBaseType,
) as (keyof typeof VectorBaseType)[]

export type VectorBaseTypeStr = keyof typeof VectorBaseType
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

export type SchemaVector<T extends VectorBaseTypeStr = VectorBaseTypeStr> =
  Base & {
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

export function isVector(
  value: unknown,
): value is
  | Int8Array<ArrayBuffer>
  | Uint8Array<ArrayBuffer>
  | Int16Array<ArrayBuffer>
  | Uint16Array<ArrayBuffer>
  | Int32Array<ArrayBuffer>
  | Uint32Array<ArrayBuffer>
  | Float32Array<ArrayBuffer>
  | Float64Array<ArrayBuffer> {
  for (const k in vectorBaseType2TypedArray) {
    if (
      value instanceof
      vectorBaseType2TypedArray[k as keyof typeof vectorBaseType2TypedArray]
    )
      return true
  }
  return false
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
  assert(def.default === undefined || isVector(def.default), 'Invalid default')

  return parseBase<SchemaVector>(
    def,
    {
      type: def.type,
      size: def.size,
      baseType: def.baseType as SchemaVector['baseType'],
      default: def.default,
    },
    true,
  )
}
