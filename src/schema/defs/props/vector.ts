import {
  VECTOR_BASE_TYPE_SIZE_MAP,
  type SchemaVector,
} from '../../../schema.js'
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
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'
import { isTypedArray } from 'util/types'

function validateVector(value: unknown): asserts value is Uint8Array {
    if (!isTypedArray(value)) {
      throw new Error('Not a typed array')
    }
    const t = vectorBaseType2TypedArray[this.schema.baseType]
    if (!(value instanceof t)) {
      throw new Error(`Not a ${t.name}`)
    }
}

export const vector = class Vector extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.vectorSize =
      schema.size * VECTOR_BASE_TYPE_SIZE_MAP[VectorBaseType[schema.baseType]]
  }
  vectorSize: number
  override type: PropTypeEnum = PropType.vector
  override validate(value: unknown): asserts value is Uint8Array {
    validateVector.call(this, value)
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
    const defaultValue = this.schema['default']
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
  compSize: number
  vecLen: number
  override type = PropType.colVec
  override validate(value: unknown): asserts value is Uint8Array {
    validateVector.call(this, value)
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
    pushSelvaSchemaColvec(buf, {
      type: PropTypeSelva.colVec,
      vecLen: this.vecLen,
      compSize: this.compSize,
      hasDefault: 0,
      //hasDefault: this.schema.default, // TODO default
    })
  }
}
