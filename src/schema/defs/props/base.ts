import type { SchemaProp } from '../../../schema.js'
import {
  LangCode,
  Modify,
  PropType,
  type LangCodeEnum,
  type ModifyEnum,
  type PropTypeEnum,
} from '../../../zigTsExports.js'
import { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import type { PropDef, TypeDef } from '../index.js'

let writeBuf: AutoSizedUint8Array
let validateBuf: AutoSizedUint8Array
export class BasePropDef implements PropDef {
  constructor(schema: SchemaProp<true>, path: string[], typeDef: TypeDef) {
    this.schema = schema
    this.path = path
    this.typeDef = typeDef
  }
  id = 0
  start = 0
  size = 0
  type: PropTypeEnum = PropType.null
  schema: SchemaProp<true>
  path: string[]
  isEdge: boolean = false
  typeDef: TypeDef
  pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ): void {
    // To be implemented by subclasses
  }
  write(
    buf: Uint8Array,
    value: unknown,
    offset: number,
    op: ModifyEnum = Modify.create,
    lang: LangCodeEnum = LangCode.none,
  ): void {
    writeBuf ??= new AutoSizedUint8Array(0, 0, buf)
    writeBuf.data = buf
    writeBuf.length = offset
    writeBuf.maxLength = buf.length
    this.pushValue(writeBuf, value, op, lang)
  }
  validate(value: unknown, lang: LangCodeEnum = LangCode.none) {
    validateBuf ??= new AutoSizedUint8Array()
    validateBuf.length = 0
    this.pushValue(writeBuf, value, Modify.create, lang)
  }
  pushSelvaSchema(buf: AutoSizedUint8Array): void {
    // To be implemented by subclasses
  }
}
