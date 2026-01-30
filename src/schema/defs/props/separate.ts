import native from '../../../native.js'
import { NOT_COMPRESSED } from '../../../protocol/index.js'
import type {
  SchemaCardinality,
  SchemaString,
  SchemaVector,
} from '../../../schema.js'
import { ENCODER } from '../../../utils/uint8.js'
import {
  pushModifyCardinalityHeader,
  PropType,
  type LangCodeEnum,
  type PropTypeEnum,
} from '../../../zigTsExports.js'
import { xxHash64 } from '../../../db-client/xxHash64.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'

export const string = class String extends BasePropDef {
  constructor(prop: SchemaString, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    if (prop.maxBytes && prop.maxBytes < 61) {
      this.size = prop.maxBytes + 1
    } else if (prop.max && prop.max < 31) {
      this.size = prop.max * 2 + 1
    }
    if (this.size) {
      this.type = PropType.stringFixed
      this.pushValue = this.pushFixedValue as any
    }
  }
  override type: PropTypeEnum = PropType.string
  override pushValue(
    buf: AutoSizedUint8Array,
    val: unknown,
    lang: LangCodeEnum,
  ): asserts val is string {
    if (typeof val !== 'string') {
      throw new Error('Invalid type for string ' + this.path.join('.'))
    }
    const prop = this.prop as SchemaString
    if (prop.min !== undefined && val.length < prop.min) {
      throw new Error(
        `Length ${val.length} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && val.length > prop.max) {
      throw new Error(
        `Length ${val.length} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    const normalized = val.normalize('NFKD')
    // TODO make header!
    // TODO compression
    buf.pushUint8(lang)
    buf.pushUint8(NOT_COMPRESSED)
    const written = buf.pushString(normalized)

    if (prop.maxBytes !== undefined) {
      if (written > prop.maxBytes) {
        throw new Error(
          `Byte length ${written} is larger than maxBytes ${
            prop.maxBytes
          } for ${this.path.join('.')}`,
        )
      }
    }
    const crc = native.crc32(buf.subarray(buf.length - written))
    buf.pushUint32(crc)
  }
  pushFixedValue(buf: AutoSizedUint8Array, val: string, lang: LangCodeEnum) {}
}

// TODO do it nice
export const text = class Text extends string {
  override type = PropType.text
}

export const json = class Json extends string {
  override type = PropType.json
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    lang: LangCodeEnum,
  ) {
    if (value === undefined) {
      throw new Error('Invalid undefined value for json ' + this.path.join('.'))
    }
    super.pushValue(buf, JSON.stringify(value), lang)
  }
}

export const binary = class Binary extends BasePropDef {
  override type = PropType.binary
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is Uint8Array {
    if (!(value instanceof Uint8Array)) {
      throw new Error('Invalid type for binary ' + this.path.join('.'))
    }
    const prop = this.prop as SchemaString
    if (prop.maxBytes !== undefined && value.byteLength > prop.maxBytes) {
      throw new Error(
        `Byte length ${value.byteLength} is larger than maxBytes ${
          prop.maxBytes
        } for ${this.path.join('.')}`,
      )
    }
    buf.set(value, buf.length)
  }
}

export const alias = class Alias extends BasePropDef {
  override type = PropType.alias
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is any {
    throw new Error('Serialize alias not implemented')
  }
}

export const cardinality = class Cardinality extends BasePropDef {
  constructor(prop: SchemaCardinality, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    this.sparse = prop.mode === 'sparse'
    this.precision = prop.precision ?? 8
  }
  sparse: boolean
  precision: number
  override type = PropType.cardinality
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is any {
    if (value instanceof Uint8Array && value.byteLength !== 8) {
      // buf.set(value, buf.length)
      throw new Error('unhandled error cardi')
    }

    if (!Array.isArray(value)) {
      value = [value]
    }

    const items = value as any[]

    if (items.length === 0) return

    pushModifyCardinalityHeader(buf, this)

    for (const item of items) {
      // validate(item, def)
      if (typeof item === 'string') {
        buf.reserveUint64()
        xxHash64(ENCODER.encode(item), buf.data, buf.length - 8)
      } else if (item instanceof Uint8Array && item.byteLength === 8) {
        buf.set(item, buf.length)
      } else {
        throw new Error('Invalid value for cardinality ' + this.path.join('.'))
      }
    }
  }
}

export const vector = class Vector extends BasePropDef {
  constructor(prop: SchemaVector, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    this.vectorSize = prop.size * 4
  }
  vectorSize: number
  override type: PropTypeEnum = PropType.vector
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is any {
    throw new Error('Serialize vector not implemented')
  }
}

export const colvec = class ColVec extends BasePropDef {
  constructor(prop: SchemaVector, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    this.colvecSize = prop.size * getByteSize(prop.baseType)
  }
  colvecSize: number
  override type = PropType.colVec
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is any {
    throw new Error('Serialize colvec not implemented')
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
