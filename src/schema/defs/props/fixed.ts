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

const validateNumber = (value: unknown, prop: any, path: string[]) => {
  if (typeof value !== 'number') {
    throw new Error('Invalid type for number ' + path.join('.'))
  }
  if (prop.min !== undefined && value < prop.min) {
    throw new Error(
      `Value ${value} is smaller than min ${prop.min} for ${path.join('.')}`,
    )
  }
  if (prop.max !== undefined && value > prop.max) {
    throw new Error(
      `Value ${value} is larger than max ${prop.max} for ${path.join('.')}`,
    )
  }
  return value
}

const validateTimestamp = (value: unknown, prop: any, path: string[]) => {
  const ts = convertToTimestamp(value as any)
  if (prop.min !== undefined && ts < prop.min) {
    throw new Error(
      `Value ${value} is smaller than min ${prop.min} for ${path.join('.')}`,
    )
  }
  if (prop.max !== undefined && ts > prop.max) {
    throw new Error(
      `Value ${value} is larger than max ${prop.max} for ${path.join('.')}`,
    )
  }
  return ts
}

const validateInteger = (
  value: unknown,
  prop: any,
  path: string[],
  type: string,
  min: number,
  max: number,
) => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Invalid type for ${type} ` + path.join('.'))
  }
  if (value < min || value > max) {
    throw new Error(`Value out of range for ${type} ` + path.join('.'))
  }
  if (prop.min !== undefined && value < prop.min) {
    throw new Error(
      `Value ${value} is smaller than min ${prop.min} for ${path.join('.')}`,
    )
  }
  if (prop.max !== undefined && value > prop.max) {
    throw new Error(
      `Value ${value} is larger than max ${prop.max} for ${path.join('.')}`,
    )
  }
  return value
}

const validateEnum = (
  value: unknown,
  vals: Map<EnumItem, number>,
  path: string[],
) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Invalid type for enum ' + path.join('.'))
  }
  if (!vals.has(value)) {
    throw new Error(`Invalid enum value ${value} for ${path.join('.')}`)
  }
  return vals.get(value) ?? 0
}

const validateBoolean = (value: unknown, path: string[]) => {
  if (typeof value !== 'boolean') {
    throw new Error('Invalid type for boolean ' + path.join('.'))
  }
  return value ? 1 : 0
}

export const number = class Number extends BasePropDef {
  override type: PropTypeEnum = PropType.number
  override size = 8
  override pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    _op?: ModifyEnum,
    _lang?: LangCodeEnum,
  ): asserts value is number {
    const val = validateNumber(value, this.schema, this.path)
    buf.pushDoubleLE(val)
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
    const ts = validateTimestamp(value, this.schema, this.path)
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
    const val = validateInteger(
      value,
      this.schema,
      this.path,
      'uint8',
      0,
      255,
    ) as number
    buf.pushUint8(val)
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
    const val = validateInteger(
      value,
      this.schema,
      this.path,
      'int8',
      -128,
      127,
    ) as number
    buf.pushUint8(val)
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
    const val = validateInteger(
      value,
      this.schema,
      this.path,
      'uint16',
      0,
      65535,
    ) as number
    buf.pushUint16(val)
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
    const val = validateInteger(
      value,
      this.schema,
      this.path,
      'int16',
      -32768,
      32767,
    ) as number
    buf.pushUint16(val)
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
    const val = validateInteger(
      value,
      this.schema,
      this.path,
      'uint32',
      0,
      4294967295,
    ) as number
    buf.pushUint32(val)
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
    const val = validateInteger(
      value,
      this.schema,
      this.path,
      'int32',
      -2147483648,
      2147483647,
    ) as number
    buf.pushUint32(val)
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
    const val = validateEnum(value, this.vals, this.path)
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
    const val = validateBoolean(value, this.path)
    buf.pushUint8(val)
  }
}
