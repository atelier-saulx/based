import type { EnumItem, SchemaEnum } from '../../../schema.js'
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
  override type: PropTypeEnum = PropType.number
  override size = 8
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number') {
      throw new Error('Invalid type for number ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushDoubleLE(value)
  }
}

export const timestamp = class Timestamp extends number {
  override type = PropType.timestamp
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number | string {
    const ts = convertToTimestamp(value as any)
    const prop = this.schema as any
    if (prop.min !== undefined && ts < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && ts > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushInt64(ts)
  }
}

export const uint8 = class Uint8 extends BasePropDef {
  override type: PropTypeEnum = PropType.uint8
  override size = 1
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Invalid type for uint8 ' + this.path.join('.'))
    }
    if (value < 0 || value > 255) {
      throw new Error('Value out of range for uint8 ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushUint8(value)
  }
}

export const int8 = class Int8 extends uint8 {
  override type = PropType.int8
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Invalid type for int8 ' + this.path.join('.'))
    }
    if (value < -128 || value > 127) {
      throw new Error('Value out of range for int8 ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushUint8(value)
  }
}

export const uint16 = class Uint16 extends BasePropDef {
  override type: PropTypeEnum = PropType.uint16
  override size = 2
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Invalid type for uint16 ' + this.path.join('.'))
    }
    if (value < 0 || value > 65535) {
      throw new Error('Value out of range for uint16 ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushUint16(value)
  }
}

export const int16 = class Int16 extends uint16 {
  override type = PropType.int16
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Invalid type for int16 ' + this.path.join('.'))
    }
    if (value < -32768 || value > 32767) {
      throw new Error('Value out of range for int16 ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushUint16(value)
  }
}

export const uint32 = class Uint32 extends BasePropDef {
  override type: PropTypeEnum = PropType.uint32
  override size = 4
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Invalid type for uint32 ' + this.path.join('.'))
    }
    if (value < 0 || value > 4294967295) {
      throw new Error('Value out of range for uint32 ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushUint32(value)
  }
}

export const int32 = class Int32 extends uint32 {
  override type = PropType.int32
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error('Invalid type for int32 ' + this.path.join('.'))
    }
    if (value < -2147483648 || value > 2147483647) {
      throw new Error('Value out of range for int32 ' + this.path.join('.'))
    }
    const prop = this.schema as any
    if (prop.min !== undefined && value < prop.min) {
      throw new Error(
        `Value ${value} is smaller than min ${prop.min} for ${this.path.join(
          '.',
        )}`,
      )
    }
    if (prop.max !== undefined && value > prop.max) {
      throw new Error(
        `Value ${value} is larger than max ${prop.max} for ${this.path.join(
          '.',
        )}`,
      )
    }
    buf.pushUint32(value)
  }
}

export const enum_ = class Enum extends uint8 {
  constructor(prop: SchemaEnum<true>, path: string[], typeDef: TypeDef) {
    super(prop, path, typeDef)
    prop.enum.forEach((val, i) => {
      const byte = i + 1
      this.enum[byte] = val
      this.vals.set(val, byte)
    })
  }
  override type = PropType.enum
  enum: Record<number, EnumItem> = {}
  vals = new Map<EnumItem, number>()

  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is EnumItem {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('Invalid type for enum ' + this.path.join('.'))
    }
    if (!this.vals.has(value)) {
      throw new Error(`Invalid enum value ${value} for ${this.path.join('.')}`)
    }
    const val = this.vals.get(value) ?? 0
    buf.pushUint8(val)
  }
}

export const boolean = class Boolean extends BasePropDef {
  override type = PropType.boolean
  override size = 1
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is boolean {
    if (typeof value !== 'boolean') {
      throw new Error('Invalid type for boolean ' + this.path.join('.'))
    }
    const val = value ? 1 : 0
    buf.pushUint8(val)
  }
}
