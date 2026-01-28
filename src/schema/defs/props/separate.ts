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

export const string = class extends BasePropDef {
  constructor(prop: SchemaString, path: string[]) {
    super(prop, path)
    if (prop.maxBytes && prop.maxBytes < 61) {
      this.size = prop.maxBytes + 1
    } else if (prop.max && prop.max < 31) {
      this.size = prop.max * 2 + 1
    }
    if (this.size) {
      // make it a fixed string prop!
      this.type = PropType.stringFixed
      this.pushValue = this.pushFixedValue
    }
  }
  override type: PropTypeEnum = PropType.string
  override pushValue(
    buf: AutoSizedUint8Array,
    val: string,
    lang: LangCodeEnum,
  ) {
    const normalized = val.normalize('NFKD')
    // TODO make header!
    // TODO compression
    buf.pushU8(lang)
    buf.pushU8(NOT_COMPRESSED)
    const written = buf.pushString(normalized)
    const crc = native.crc32(buf.subarray(buf.length - written))
    buf.pushU32(crc)
  }
  pushFixedValue(buf: AutoSizedUint8Array, val: string, lang: LangCodeEnum) {}
}

// TODO do it nice
export const text = class extends string {
  override type = PropType.text
}

export const json = class extends string {
  override type = PropType.json
  override pushValue(buf: AutoSizedUint8Array, value: any, lang: LangCodeEnum) {
    super.pushValue(buf, JSON.stringify(value), lang)
  }
}

export const binary = class extends BasePropDef {
  override type = PropType.binary
  override pushValue(buf: AutoSizedUint8Array, value: Uint8Array) {
    buf.set(value, buf.length)
  }
}

export const alias = class extends BasePropDef {
  override type = PropType.alias
  override pushValue(buf: AutoSizedUint8Array, value: any) {
    throw new Error('Serialize alias not implemented')
  }
}

export const cardinality = class extends BasePropDef {
  constructor(prop: SchemaCardinality, path) {
    super(prop, path)
    this.sparse = prop.mode === 'sparse'
    this.precision = prop.precision ?? 8
  }
  sparse: boolean
  precision: number
  override type = PropType.cardinality
  override pushValue(buf: AutoSizedUint8Array, value: any) {
    if (value instanceof Uint8Array && value.byteLength !== 8) {
      // buf.set(value, buf.length)
      throw new Error('unhandled error cardi')
    }

    if (!Array.isArray(value)) {
      value = [value]
    }

    if (value.length === 0) return

    pushModifyCardinalityHeader(buf, this)

    for (const item of value) {
      // validate(item, def)
      if (typeof item === 'string') {
        buf.reserveU64()
        xxHash64(ENCODER.encode(item), buf.data, buf.length - 8)
      } else if (item instanceof Uint8Array && item.byteLength === 8) {
        buf.set(item, buf.length)
      } else {
        throw new Error('unhandled error cardi')
        // throw [def, val]
      }
    }
  }
}

export const vector = class extends BasePropDef {
  constructor(prop: SchemaVector, path) {
    super(prop, path)
    this.vectorSize = prop.size * 4
  }
  vectorSize: number
  override type: PropTypeEnum = PropType.vector
  override pushValue(buf: AutoSizedUint8Array, value: any) {
    throw new Error('Serialize vector not implemented')
  }
}

export const colvec = class extends BasePropDef {
  constructor(prop: SchemaVector, path) {
    super(prop, path)
    this.colvecSize = prop.size * getByteSize(prop.baseType)
  }
  colvecSize: number
  override type = PropType.colVec
  override pushValue(buf: AutoSizedUint8Array, value: any) {
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
