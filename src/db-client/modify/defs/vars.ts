import native from '../../../native.js'
import { NOT_COMPRESSED } from '../../../protocol/index.js'
import type { SchemaString, SchemaVector } from '../../../schema.js'
import {
  PropType,
  type LangCodeEnum,
  type ModifyEnum,
  type PropTypeEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'

export const string = class extends BasePropDef {
  constructor(prop: SchemaString, path) {
    super(prop, path)
    if (prop.maxBytes && prop.maxBytes < 61) {
      this.size = prop.maxBytes + 1
    } else if (prop.max && prop.max < 31) {
      this.size = prop.max * 2 + 1
    }
    if (this.size) {
    }
  }
  override type: PropTypeEnum = PropType.string
  override pushValue(
    buf: AutoSizedUint8Array,
    val: string,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ) {
    const normalized = val.normalize('NFKD')
    buf.pushU8(lang)
    buf.pushU8(NOT_COMPRESSED)
    const written = buf.pushString(normalized)
    const crc = native.crc32(buf.subarray(buf.length - written))
    buf.pushU32(crc)
  }
}

// TODO do it nice
export const text = class extends string {
  override type = PropType.text
}

export const json = class extends string {
  override type = PropType.json
  override pushValue(
    buf: AutoSizedUint8Array,
    value: any,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ) {
    super.pushValue(buf, JSON.stringify(value), op, lang)
  }
}

export const binary = class extends BasePropDef {
  override type = PropType.binary
  override pushValue(buf: AutoSizedUint8Array, value: Uint8Array) {
    buf.set(value, buf.length)
    buf.length += value.length
  }
}

export const alias = class extends BasePropDef {
  override type = PropType.alias
  override pushValue(buf: AutoSizedUint8Array, value: any) {
    throw new Error('Serialize alias not implemented')
  }
}

export const cardinality = class extends BasePropDef {
  override type = PropType.cardinality
  override pushValue(buf: AutoSizedUint8Array, value: any) {
    throw new Error('Serialize cardinality not implemented')
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
