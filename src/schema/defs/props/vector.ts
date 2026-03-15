import { type SchemaVector } from '../../../schema/index.js'
import { vectorBaseType2TypedArray } from '../../../schema/schema/vector.js'
import {
  PropType,
  type LangCodeEnum,
  type PropTypeEnum,
  type ModifyEnum,
  PropTypeSelva,
  pushSelvaSchemaColvec,
  pushSelvaSchemaMicroBuffer,
  VectorBaseType,
  type VectorBaseTypeEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'
import { TypedArray } from '../../../schema/index.js'

export const VECTOR_BASE_TYPE_SIZE_MAP: Record<VectorBaseTypeEnum, number> = {
  [VectorBaseType.int8]: 1,
  [VectorBaseType.uint8]: 1,
  [VectorBaseType.int16]: 2,
  [VectorBaseType.uint16]: 2,
  [VectorBaseType.int32]: 4,
  [VectorBaseType.uint32]: 4,
  [VectorBaseType.float32]: 4,
  [VectorBaseType.float64]: 8,
}

export const vector = class Vector extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.vectorSize =
      schema.size * VECTOR_BASE_TYPE_SIZE_MAP[VectorBaseType[schema.baseType]]
  }
  declare schema: SchemaVector
  vectorSize: number
  override type: PropTypeEnum = PropType.vector
  override validate(value: unknown): asserts value is TypedArray {
    const t = vectorBaseType2TypedArray[this.schema['baseType']]
    if (!(value instanceof t)) {
      throw new Error(`Not a ${t.name}`)
    }
    if ((value as TypedArray).byteLength > this.vectorSize) {
      throw new Error('Vector too long')
    }
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is any {
    this.validate(value)
    const v = new Uint8Array(value.buffer).subarray(
      0,
      Math.min(value.byteLength, this.vectorSize),
    )
    buf.set(v, buf.length)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    const defaultValue = this.schema.default
    pushSelvaSchemaMicroBuffer(buf, {
      type: PropTypeSelva.microBuffer,
      len: this.vectorSize,
      hasDefault: ~~!!defaultValue,
    })
    if (defaultValue) {
      const v = new Uint8Array(defaultValue.buffer, 0, this.vectorSize)
      buf.set(v, buf.length)
    }
  }
}

// This will become similar to Main BUFFER
// and it can use it if there is an option used like "appendOnly: true" on the type
// then we can switch to colvec for all main buffer props
// if there are no var props we can iterate straight trough the colvec list using another iterator
export const colvec = class ColVec extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.compSize = VECTOR_BASE_TYPE_SIZE_MAP[VectorBaseType[schema.baseType]]
    this.vecLen = schema.size
  }
  declare schema: SchemaVector
  compSize: number
  vecLen: number
  override type = PropType.colVec
  override validate(value: unknown): asserts value is Uint8Array {
    const t = vectorBaseType2TypedArray[this.schema.baseType]
    if (!(value instanceof t)) {
      throw new Error(`Not a ${t.name}`)
    }
    if ((value as TypedArray).byteLength > this.vecLen * this.compSize) {
      throw new Error('Vector too long')
    }
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op: ModifyEnum,
    _lang: LangCodeEnum,
  ): asserts value is any {
    this.validate(value)
    const v = new Uint8Array(value.buffer).subarray(
      0,
      Math.min(value.byteLength, this.vecLen * this.compSize),
    )
    buf.set(v, buf.length)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    const defaultValue = this.schema.default
    pushSelvaSchemaColvec(buf, {
      type: PropTypeSelva.colVec,
      vecLen: this.vecLen,
      compSize: this.compSize,
      hasDefault: ~~!!defaultValue,
    })
    if (defaultValue) {
      const v = new Uint8Array(
        defaultValue.buffer,
        0,
        this.vecLen * this.compSize,
      )
      buf.set(v, buf.length)
    }
  }
}
