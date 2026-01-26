import type { SchemaProp } from '../../schema.js'
import type { LangCodeEnum, ModifyEnum } from '../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../AutoSizedUint8Array.js'
import type { PropDef } from './index.js'

export class BasePropDef implements PropDef {
  constructor(prop: SchemaProp<true>, path: string[]) {
    this.prop = prop
    this.path = path
  }
  id = 0
  start = 0
  size = 0
  type = 0
  prop: SchemaProp<true>
  path: string[]

  pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ): void {
    // To be implemented by subclasses
  }
}
