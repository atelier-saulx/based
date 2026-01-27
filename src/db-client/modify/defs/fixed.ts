import type { EnumItem, SchemaEnum } from '../../../schema.js'
import { convertToTimestamp } from '../../../utils/timestamp.js'
import { PropType, type PropTypeEnum } from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../AutoSizedUint8Array.js'
import { BasePropDef } from './base.js'

export const number = class extends BasePropDef {
  override type: PropTypeEnum = PropType.number
  override size = 8
  override pushValue(buf: AutoSizedUint8Array, value: number) {
    buf.pushDouble(value)
  }
}

export const timestamp = class extends number {
  override type = PropType.timestamp
  override pushValue(buf: AutoSizedUint8Array, value: number | string) {
    buf.pushI64(convertToTimestamp(value))
  }
}

export const uint8 = class extends BasePropDef {
  override type: PropTypeEnum = PropType.uint8
  override size = 1
  override pushValue(buf: AutoSizedUint8Array, value: number): void {
    buf.pushU8(value)
  }
}

export const int8 = class extends uint8 {
  override type = PropType.int8
}

export const uint16 = class extends BasePropDef {
  override type: PropTypeEnum = PropType.uint16
  override size = 2
  override pushValue(buf: AutoSizedUint8Array, value: number): void {
    buf.pushU16(value)
  }
}

export const int16 = class extends uint16 {
  override type = PropType.int16
}

export const uint32 = class extends BasePropDef {
  override type: PropTypeEnum = PropType.uint32
  override size = 4
  override pushValue(buf: AutoSizedUint8Array, value: number): void {
    buf.pushU32(value)
  }
}

export const int32 = class extends uint32 {
  override type = PropType.int32
}

export const enum_ = class extends uint8 {
  constructor(prop: SchemaEnum<true>, path: string[]) {
    super(prop, path)
    prop.enum.forEach((val, i) => {
      const byte = i + 1
      this.enum[byte] = val
      this.vals.set(val, byte)
    })
  }
  override type = PropType.enum
  enum: Record<number, EnumItem> = {}
  vals = new Map<EnumItem, number>()

  override pushValue(buf: AutoSizedUint8Array, value: EnumItem): void {
    buf.pushU8(this.vals.get(value) ?? 0)
  }
}

export const boolean = class extends BasePropDef {
  override type = PropType.boolean
  override size = 1
  override pushValue(buf: AutoSizedUint8Array, value: boolean): void {
    buf.pushU8(value ? 1 : 0)
  }
}

// export const created = class extends number {
//   override type = PropType.created
// }

// export const updated = class extends number {
//   override type = PropType.updated
// }
