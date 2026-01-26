import type { SchemaProp } from '../../schema.js'
import type { LangCodeEnum, ModifyEnum } from '../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../AutoSizedUint8Array.js'
import * as fixed from './fixed.js'
import * as references from './references.js'

import * as vars from './vars.js'

export type PropTree = Map<string, PropDef | PropTree>

export type TypeDef = {
  // mainSize: number
  id: number
  main: PropDef[]
  separate: PropDef[]
  props: Map<string, PropDef>
  tree: PropTree
}

export type PropDef = {
  id: number
  type: number
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
