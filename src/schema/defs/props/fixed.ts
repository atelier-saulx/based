import type {
  EnumItem,
  SchemaEnum,
  SchemaNumber,
  SchemaProp,
} from '../../../schema.js'
import { convertToTimestamp } from '../../../utils/timestamp.js'
import {
  PropType,
  type PropTypeEnum,
  type ModifyEnum,
  type LangCodeEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'
import type { TypeDef } from '../index.js'

export const number = class Number extends BasePropDef {
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min !== undefined) this.min = schema.min
    if (schema.max !== undefined) this.max = schema.max
  }
  override type: PropTypeEnum = PropType.number
  override size = 8
  min = -globalThis.Number.MAX_VALUE
  max = globalThis.Number.MAX_VALUE
  override validate(value: unknown): asserts value is number {
    if (typeof value !== 'number' || !globalThis.Number.isFinite(value)) {
      throw new Error(
        `Invalid type for ${this.schema.type} ${this.path.join('.')}`,
      )
    }
    if (this.min !== undefined && value < this.min) {
      throw new Error(
        `Value ${value} is smaller than min ${this.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (this.max !== undefined && value > this.max) {
      throw new Error(
        `Value ${value} is larger than max ${this.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushDoubleLE(value)
  }
}

export const timestamp = class Timestamp extends number {
  override type = PropType.timestamp
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number | string {
    const ts = convertToTimestamp(value as any)
    this.validate(ts)
    buf.pushInt64(ts)
  }
}

class integer extends number {
  override validate(value: unknown): asserts value is number {
    super.validate(value)
    if (!Number.isInteger(value)) {
      throw new Error(
        `Invalid type for ${this.schema.type} ${this.path.join('.')}`,
      )
    }
  }
}

export const uint8 = class Uint8 extends integer {
  override type: PropTypeEnum = PropType.uint8
  override size = 1
  override min = 0
  override max = 255
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushUint8(value)
  }
}

export const int8 = class Int8 extends uint8 {
  override type = PropType.int8
  override min = -128
  override max = 127
}

export const uint16 = class Uint16 extends integer {
  override type: PropTypeEnum = PropType.uint16
  override size = 2
  override min = 0
  override max = 65535
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushUint16(value)
  }
}

export const int16 = class Int16 extends uint16 {
  override type = PropType.int16
  override min = -32768
  override max = 32767
}

export const uint32 = class Uint32 extends integer {
  override type: PropTypeEnum = PropType.uint32
  override size = 4
  override min = 0
  override max = 4294967295
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushUint32(value)
  }
}

export const int32 = class Int32 extends uint32 {
  override type = PropType.int32
  override min = -2147483648
  override max = 2147483647
}

export const enum_ = class Enum extends BasePropDef {
  constructor(prop: SchemaEnum<true>, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    prop.enum.forEach((val, i) => {
      const byte = i + 1
      this.enum[byte] = val
      this.vals.set(val, byte)
    })
  }

  override type = PropType.enum
  override size = 1

  enum: Record<number, EnumItem> = {}
  vals = new Map<EnumItem, number>()
  override validate(value: unknown): asserts value is EnumItem {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('Invalid type for enum ' + this.path.join('.'))
    }
    if (!this.vals.has(value)) {
      throw new Error(`Invalid enum value ${value} for ${this.path.join('.')}`)
    }
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is EnumItem {
    this.validate(value)
    buf.pushUint8(this.vals.get(value) ?? 0)
  }
}

export const boolean = class Boolean extends BasePropDef {
  override type = PropType.boolean
  override size = 1
  override validate(value: unknown): asserts value is boolean {
    if (typeof value !== 'boolean') {
      throw new Error('Invalid type for boolean ' + this.path.join('.'))
    }
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is boolean {
    this.validate(value)
    buf.pushUint8(~~value)
  }
}
