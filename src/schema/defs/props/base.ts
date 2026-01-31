import type { SchemaProp } from '../../../schema.js'
import {
  PropType,
  PropTypeSelva,
  type LangCodeEnum,
  type ModifyEnum,
  type PropTypeEnum,
  type PropTypeSelvaEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import type { PropDef, TypeDef } from '../index.js'

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
    op?: ModifyEnum,
    lang?: LangCodeEnum,
  ): void {
    // To be implemented by subclasses
  }
  pushSelvaSchema(buf: AutoSizedUint8Array): void {
    // To be implemented by subclasses
  }
}
