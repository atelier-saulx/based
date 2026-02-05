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

export const vector = class Vector extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.vectorSize = schema.size * 4
  }
  vectorSize: number
  override type: PropTypeEnum = PropType.vector
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is any {
    throw new Error('Serialize vector not implemented')
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaMicroBuffer(buf, {
      type: PropTypeSelva.colVec,
      len: this.vectorSize,
      hasDefault: 0, // TODO default
    })
  }
}

// This will become similair to Main BUFFER
// and it can use it if there is an option used like "appendOnly: true" on the type
// then we can switch to colvec for all main buffer props
// if there are no var props we can iterate straight trough the colvec list using another iterator
export const colvec = class ColVec extends BasePropDef {
  constructor(schema: SchemaVector, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    this.compSize = getByteSize(schema.baseType)
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
    throw new Error('Serialize colvec not implemented')
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

function getByteSize(str?: string) {
  switch (str) {
    case 'int8':
    case 'uint8':
      return 1
    case 'int16':
    case 'uint16':
      return 2
    case 'int32':
    case 'uint32':
    case 'float32':
      return 4
    default:
      return 8
  }
}
