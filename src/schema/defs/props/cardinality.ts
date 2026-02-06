import type { SchemaCardinality } from '../../../schema.js'
import { ENCODER } from '../../../utils/uint8.js'
import {
  pushModifyCardinalityHeader,
  PropType,
  PropTypeSelva,
  pushSelvaSchemaString,
} from '../../../zigTsExports.js'
import { xxHash64 } from '../../../db-client/xxHash64.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'

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
