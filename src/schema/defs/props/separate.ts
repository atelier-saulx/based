import native from '../../../native.js'
import { COMPRESSED, NOT_COMPRESSED } from '../../../protocol/index.js'
import type {
  SchemaBinary,
  SchemaCardinality,
  SchemaString,
  SchemaText,
  SchemaVector,
} from '../../../schema.js'
import { ENCODER } from '../../../utils/uint8.js'
import {
  pushModifyCardinalityHeader,
  PropType,
  type LangCodeEnum,
  type PropTypeEnum,
  type ModifyEnum,
  PropTypeSelva,
  pushSelvaSchemaColvec,
  pushSelvaSchemaMicroBuffer,
  pushSelvaSchemaString,
  pushSelvaSchemaText,
  LangCode,
  writeSelvaSchemaStringProps,
} from '../../../zigTsExports.js'
import { xxHash64 } from '../../../db-client/xxHash64.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'

const validateMaxBytes = (
  bytes: number,
  prop: { maxBytes?: number },
  path: string[],
) => {
  if (prop.maxBytes !== undefined) {
    if (bytes > prop.maxBytes) {
      throw new Error(
        `Byte length ${bytes} is larger than maxBytes ${
          prop.maxBytes
        } for ${path.join('.')}`,
      )
    }
  }
}

function validateString(
  value: unknown,
  prop: { min?: number; max?: number },
  path: string[],
): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('Invalid type for string ' + path.join('.'))
  }
  if (prop.min !== undefined && value.length < prop.min) {
    throw new Error(
      `Length ${value.length} is smaller than min ${prop.min} for ${path.join(
        '.',
      )}`,
    )
  }
  if (prop.max !== undefined && value.length > prop.max) {
    throw new Error(
      `Length ${value.length} is larger than max ${prop.max} for ${path.join(
        '.',
      )}`,
    )
  }
}

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
      this.pushValue = this.pushFixedValue
    } else if (prop.compression === 'none') {
      this.deflate = false
    }
  }
  deflate = true
  declare schema: SchemaString
  override type: PropTypeEnum = PropType.string
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    lang: LangCodeEnum = LangCode.none,
  ): asserts value is string {
    validateString(value, this.schema, this.path)
    const normalized = value.normalize('NFKD')
    buf.pushUint8(lang)
    if (this.deflate && normalized.length > 200) {
      buf.pushUint8(COMPRESSED)
      const sizePos = buf.reserveUint32()
      const stringPos = buf.length
      const written = buf.pushString(normalized)
      buf.ensure(buf.length + written)
      buf.data.copyWithin(buf.length, buf.length - written, buf.length)
      const size = native.compress(buf.data, stringPos, written)
      if (size !== 0) {
        buf.writeUint32(written, sizePos)
        buf.length = stringPos + size
        validateMaxBytes(size, this.schema, this.path)
        const crc = native.crc32(buf.subarray(stringPos))
        buf.pushUint32(crc)
        return
      }
      buf.length = sizePos - 1
    }
    buf.pushUint8(NOT_COMPRESSED)
    const written = buf.pushString(normalized)
    validateMaxBytes(written, this.schema, this.path)
    const crc = native.crc32(buf.subarray(buf.length - written))
    buf.pushUint32(crc)
  }

  pushFixedValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is string {
    validateString(value, this.schema, this.path)
    const size = native.stringByteLength(value)
    validateMaxBytes(size, this.schema, this.path)
    buf.pushUint8(size)
    buf.pushString(value)
    const padEnd = this.size - size - 1
    if (padEnd) {
      buf.fill(0, buf.length, buf.length + padEnd)
    }
  }

  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    const index = pushSelvaSchemaString(buf, {
      type: PropTypeSelva.string,
      fixedLen: 0,
      defaultLen: 0,
    })
    if (this.schema.default) {
      const start = buf.length
      this.pushValue(buf, this.schema.default)
      writeSelvaSchemaStringProps.defaultLen(
        buf.data,
        buf.length - start,
        index,
      )
    }
  }
}

export const text = class Text extends string {
  override type = PropType.text
  // @ts-ignore
  declare schema: SchemaText
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op?: ModifyEnum,
    lang: LangCodeEnum = LangCode.none,
  ) {
    if (typeof value === 'string') {
      const index = buf.reserveUint32()
      const start = buf.length
      super.pushValue(buf, value, op, lang)
      buf.writeUint32(buf.length - start, index)
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (!(key in LangCode)) {
          throw new Error(
            `Invalid locale ${key} for text ${this.path.join('.')}`,
          )
        }
        const index = buf.reserveUint32()
        const start = buf.length
        super.pushValue(buf, value[key], op, LangCode[key])
        buf.writeUint32(buf.length - start, index)
      }
    } else {
      throw new Error('Invalid type for text ' + this.path.join('.'))
    }
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    if (this.schema.default) {
      pushSelvaSchemaText(buf, {
        type: PropTypeSelva.text,
        nrDefaults: Object.keys(this.schema.default).length,
      })
      this.pushValue(buf, this.schema.default)
    } else {
      pushSelvaSchemaText(buf, {
        type: PropTypeSelva.text,
        nrDefaults: 0,
      })
    }
  }
}

export const json = class Json extends string {
  override type = PropType.json
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op?: ModifyEnum,
    lang: LangCodeEnum = LangCode.none,
  ) {
    super.pushValue(buf, JSON.stringify(value), op, lang)
  }
}

export const binary = class Binary extends BasePropDef {
  constructor(prop: SchemaString, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    if (prop.maxBytes && prop.maxBytes < 61) {
      this.size = prop.maxBytes + 1
    }
    if (this.size) {
      this.type = PropType.binaryFixed
      this.pushValue = this.pushFixedValue
    }
  }
  override type: PropTypeEnum = PropType.binary
  declare schema: SchemaBinary
  override validate(value: unknown): asserts value is Uint8Array {
    if (!(value instanceof Uint8Array)) {
      throw new Error('Invalid type for binary ' + this.path.join('.'))
    }
    validateMaxBytes(value.byteLength, this.schema, this.path)
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is Uint8Array {
    this.validate(value)
    const crc = native.crc32(value)
    buf.pushUint8(LangCode.none)
    buf.pushUint8(NOT_COMPRESSED)
    buf.set(value, buf.length)
    buf.pushUint32(crc)
  }
  pushFixedValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is Uint8Array {
    this.validate(value)
    buf.pushUint8(value.byteLength)
    buf.set(value, buf.length)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaString(buf, {
      type: PropTypeSelva.string,
      fixedLen: 0,
      defaultLen: 0,
    })
  }
}

export const alias = class Alias extends BasePropDef {
  override type = PropType.alias
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is string {
    if (typeof value !== 'string') {
      throw new Error('Invalid type for alias ' + this.path.join('.'))
    }
    buf.pushString(value)
  }
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    buf.pushUint8(PropTypeSelva.alias)
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
    if (!Array.isArray(value)) {
      value = [value]
    }

    const items = value as any[]
    if (items.length === 0) return
    pushModifyCardinalityHeader(buf, this)
    for (const item of items) {
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
  override pushSelvaSchema(buf: AutoSizedUint8Array) {
    pushSelvaSchemaString(buf, {
      type: PropTypeSelva.string,
      fixedLen: 0,
      defaultLen: 0,
    })
  }
}

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
