import type { SchemaProp } from '../../../schema.js'
import type {
  LangCodeEnum,
  ModifyEnum,
  PropTypeEnum,
} from '../../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../../utils/AutoSizedUint8Array.js'
import type { PropDef, TypeDef } from '../index.js'

export class BasePropDef implements PropDef {
  constructor(prop: SchemaProp<true>, path: string[], typeDef: TypeDef) {
    this.prop = prop
    this.path = path
    this.typeDef = typeDef
  }
  id = 0
  start = 0
  size = 0
  type: PropTypeEnum = 0 as PropTypeEnum
  prop: SchemaProp<true>
  path: string[]
  isEdge: boolean = false
  typeDef: TypeDef
  pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    lang: LangCodeEnum,
    op: ModifyEnum,
  ): void {
    // To be implemented by subclasses
  }
}

const filter = [
  {
    field: 'nr',
    op: '<',
    value: 10,
    and: {
      field: 'nr',
    },
  },
]
