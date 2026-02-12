import native from '../../../native.js'
import { COMPRESSED, NOT_COMPRESSED } from '../../../protocol/index.js'
import type { SchemaString, SchemaText } from '../../../schema.js'
import {
  PropType,
  type LangCodeEnum,
  type PropTypeEnum,
  type ModifyEnum,
  PropTypeSelva,
  pushSelvaSchemaString,
  pushSelvaSchemaText,
  LangCode,
  writeSelvaSchemaStringProps,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'
import { validateMaxBytes } from './utils.js'

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
      // TODO explain why 61 bytes (1 byte is for size but why 60 byte and not 47 or 63? */
      this.size = prop.maxBytes + 1
    } else if (prop.max && prop.max < 31) {
      // TODO Explain why this is here
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
  ): asserts value is string | Uint8Array {
    if (value instanceof Uint8Array) {
      buf.pushUint32(value.byteLength)
      buf.set(value, buf.length)
    } else {
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
      fixedLenHint: this.schema.maxBytes ?? 0, // Note that selva doesn't do actual validation
      defaultLen: 0, // TODO also check that defaultLen <= maxBytes
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
