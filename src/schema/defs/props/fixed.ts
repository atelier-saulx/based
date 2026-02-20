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
  override type: PropTypeEnum = PropType.timestamp
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
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min === undefined) this.min = 0
    else if (schema.min < 0) this.min = 0
    if (schema.max === undefined) this.max = 255
    else if (schema.max > 255) this.max = 255
  }
  override type: PropTypeEnum = PropType.uint8
  override size = 1
  override validate(value: unknown): asserts value is number {
    super.validate(value)
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushUint8(value)
  }
}

export const int8 = class Int8 extends uint8 {
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min === undefined) this.min = -128
    else if (schema.min < -128) this.min = -128
    if (schema.max === undefined) this.max = 127
    else if (schema.max > 127) this.max = 127
  }
  override type = PropType.int8
}

export const uint16 = class Uint16 extends integer {
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min === undefined) this.min = 0
    else if (schema.min < 0) this.min = 0
    if (schema.max === undefined) this.max = 65535
    else if (schema.max > 65535) this.max = 65535
  }
  override type: PropTypeEnum = PropType.uint16
  override size = 2
  override validate(value: unknown): asserts value is number {
    super.validate(value)
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushUint16(value)
  }
}

export const int16 = class Int16 extends uint16 {
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min === undefined) this.min = -32768
    else if (schema.min < -32768) this.min = -32768
    if (schema.max === undefined) this.max = 32767
    else if (schema.max > 32767) this.max = 32767
  }
  override type = PropType.int16
}

export const uint32 = class Uint32 extends integer {
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min === undefined) this.min = 0
    else if (schema.min < 0) this.min = 0
    if (schema.max === undefined) this.max = 4294967295
    else if (schema.max > 4294967295) this.max = 4294967295
  }
  override type: PropTypeEnum = PropType.uint32
  override size = 4
  override validate(value: unknown): asserts value is number {
    super.validate(value)
  }
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
  ): asserts value is number {
    this.validate(value)
    buf.pushUint32(value)
  }
}

export const int32 = class Int32 extends uint32 {
  constructor(schema: SchemaNumber, path: string[], typeDef: TypeDef) {
    super(schema, path, typeDef)
    if (schema.min === undefined) this.min = -2147483648
    else if (schema.min < -2147483648) this.min = -2147483648
    if (schema.max === undefined) this.max = 2147483647
    else if (schema.max > 2147483647) this.max = 2147483647
  }
  override type = PropType.int32
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
