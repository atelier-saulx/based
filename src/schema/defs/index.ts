import type { SchemaProp } from '../../schema.js'
import type {
  LangCodeEnum,
  ModifyEnum,
  PropTypeEnum,
} from '../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import * as fixed from './props/fixed.js'
import * as references from './props/references.js'
import * as vars from './props/separate.js'

export type PropTree = Map<string, PropDef | PropTree>

export type TypeDef = {
  id: number
  main: PropDef[]
  separate: PropDef[]
  props: Map<string, PropDef>
  tree: PropTree
}

export type PropDef = {
  id: number
  type: PropTypeEnum
  start: number
  path: string[]
  size: number
  prop: SchemaProp<true>
  edges?: TypeDef
  ref?: TypeDef
  refProp?: PropDef
  pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang: LangCodeEnum,
  ): void
}

export type PropDefClass = {
  new (prop: SchemaProp<true>, path: string[]): PropDef
}

export const defs: Record<
  Exclude<SchemaProp<true>['type'], 'object'>,
  PropDefClass
> = {
  ...references,
  ...fixed,
  ...vars,
  enum: fixed.enum_,
}
