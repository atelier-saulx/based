import type { SchemaVector } from '../../../schema.js'
import {
  PropType,
  type LangCodeEnum,
  type PropTypeEnum,
  type ModifyEnum,
  PropTypeSelva,
  pushSelvaSchemaColvec,
  pushSelvaSchemaMicroBuffer,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'
import { isTypedArray } from 'util/types'

const baseTypeSize: { [K in SchemaVector['baseType']]: number } = {
  number: 8,
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  float32: 8,
  float64: 8,
}

export const vector = class Vector extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.vectorSize = schema.size * baseTypeSize[schema.baseType]
  }
  vectorSize: number
  override type: PropTypeEnum = PropType.vector
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is any {
    if (!isTypedArray(value)) {
      throw new Error('Not a typed array')
    }
    const v = new Uint8Array(value.buffer).subarray(
      0,
      Math.min(value.byteLength, this.vectorSize),
    )
    buf.set(v, buf.length)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaMicroBuffer(buf, {
      type: PropTypeSelva.microBuffer,
      len: this.vectorSize,
      hasDefault: 0, // TODO default
    })
  }
}

// This will become similar to Main BUFFER
// and it can use it if there is an option used like "appendOnly: true" on the type
// then we can switch to colvec for all main buffer props
// if there are no var props we can iterate straight trough the colvec list using another iterator
export const colvec = class ColVec extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.compSize = baseTypeSize[schema.baseType]
    this.vecLen = schema.size * this.compSize
  }
  compSize: number
  vecLen: number
  override type = PropType.colVec
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op: ModifyEnum,
    _lang: LangCodeEnum,
  ): asserts value is any {
    if (!isTypedArray(value)) {
      throw new Error('Not a typed array')
    }
    const v = new Uint8Array(value.buffer).subarray(
      0,
      Math.min(value.byteLength, this.vecLen),
    )
    buf.set(v, buf.length)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaColvec(buf, {
      type: PropTypeSelva.colVec,
      vecLen: this.vecLen,
      compSize: this.compSize,
      hasDefault: 0,
    })
  }
}
