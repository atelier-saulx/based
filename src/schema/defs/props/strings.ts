import native from '../../../native.js'
import { COMPRESSED, NOT_COMPRESSED } from '../../../protocol/index.js'
import type { SchemaJson, SchemaString } from '../../../schema/index.js'
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
  Modify,
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
    if (prop.localized) {
      this.pushValue = this.pushLocalizedValue
      this.pushSelvaSchema = this.pushSelvaSchemaLocalized
      this.deflate = prop.compression !== 'none'
      this.type = PropType.stringLocalized
    } else if (prop.maxBytes && prop.maxBytes <= 64) {
      // 64 bytes fit in 1 cpu instruction to read */
      this.size = prop.maxBytes + 1
      this.type = PropType.stringFixed
      this.pushValue = this.pushFixedValue
    } else if (prop.max && prop.max <= 32) {
      // We estimate that size is probably * 2 maxium for strings len
      // this is an estimation so might be incorrect
      this.size = prop.max * 2 + 1
      this.type = PropType.stringFixed
      this.pushValue = this.pushFixedValue
    } else {
      this.pushValue = this.pushSingleValue
      this.deflate = prop.compression !== 'none'
    }
  }
  deflate = true
  declare schema: SchemaString
  override type: PropTypeEnum = PropType.string

  pushSingleValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    lang: LangCodeEnum = LangCode.none,
  ): asserts value is string | Uint8Array {
    if (value === null) value = '' // TODO We might want to handle nulls in a different way: FDN-1998 and FDN-2005
     if (value instanceof Uint8Array) {
      buf.pushUint32(value.byteLength)
      buf.set(value, buf.length)
    } else {
      validateString(value, this.schema, this.path)
      const normalized = value.normalize('NFKD')
      buf.pushUint8(lang)
      if (this.deflate && normalized.length > 300) {
        buf.pushUint8(COMPRESSED)
        const sizePos = buf.reserveUint32()
        const stringPos = buf.length
        const written = buf.pushString(normalized)
        const crc = native.crc32(buf.subarray(stringPos))
        buf.ensure(buf.length + written)
        buf.data.copyWithin(buf.length, buf.length - written, buf.length)
        const size = native.compress(buf.data, stringPos, written)
        if (size !== 0) {
          buf.writeUint32(written, sizePos)
          buf.length = stringPos + size
          validateMaxBytes(size, this.schema, this.path)
          buf.pushUint32(crc)
          return
        }
        // can optimize for this case (no need to pushString again, could copy it to right loc)
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

  pushLocalizedValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op?: ModifyEnum,
    lang: LangCodeEnum = LangCode.none,
  ) {
    if (typeof value === 'string') {
      if (lang === LangCode.none) {
        throw new Error(
          `Invalid type, text needs to be an object ${this.path.join('.')}`,
        )
      }
      const index = buf.reserveUint32()
      const start = buf.length
      this.pushSingleValue(buf, value, op, lang)
      buf.writeUint32(buf.length - start, index)
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        throw new Error('Invalid type for text ' + this.path.join('.'))
      }
      for (const key in value) {
        if (!(key in LangCode)) {
          throw new Error(
            `Invalid locale ${key} for text ${this.path.join('.')}`,
          )
        }
        const index = buf.reserveUint32()
        const start = buf.length
        this.pushSingleValue(buf, value[key], op, LangCode[key])
        buf.writeUint32(buf.length - start, index)
      }
    } else {
      throw new Error('Invalid type for text ' + this.path.join('.'))
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
      this.pushValue(buf, this.schema.default, Modify.create, LangCode.none)
      writeSelvaSchemaStringProps.defaultLen(
        buf.data,
        buf.length - start,
        index,
      )
    }
  }

  pushSelvaSchemaLocalized(buf: AutoSizedUint8Array) {
    if (this.schema.default) {
      pushSelvaSchemaText(buf, {
        type: PropTypeSelva.text,
        nrDefaults: Object.keys(this.schema.default).length,
      })
      this.pushValue(buf, this.schema.default, Modify.create, LangCode.none)
    } else {
      pushSelvaSchemaText(buf, {
        type: PropTypeSelva.text,
        nrDefaults: 0,
      })
    }
  }
}

export const json = class Json extends string {
  constructor(prop: SchemaJson, path: string[], typeDef: TypeDef) {
    super(prop as any, path, typeDef)
    this.type = prop.localized ? PropType.jsonLocalized : PropType.json
  }
  override pushSingleValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang: LangCodeEnum = LangCode.none,
  ) {
    super.pushSingleValue(buf, JSON.stringify(value), op, lang)
  }
}
