import native from '../../../native.js'
import { NOT_COMPRESSED } from '../../../protocol/index.js'
import type { SchemaBinary, SchemaString } from '../../../schema.js'
import {
  PropType,
  type PropTypeEnum,
  PropTypeSelva,
  pushSelvaSchemaString,
  LangCode,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'
import { validateMaxBytes } from './utils.js'

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
