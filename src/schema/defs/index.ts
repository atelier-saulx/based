import type { SchemaOut, SchemaProp, SchemaType } from '../../schema.js'
import type {
  LangCodeEnum,
  ModifyEnum,
  PropTypeEnum,
} from '../../zigTsExports.js'
import type { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import * as references from './props/references.js'
import * as fixed from './props/fixed.js'
import * as alias from './props/alias.js'
import * as binary from './props/binary.js'
import * as cardinality from './props/cardinality.js'
import * as strings from './props/strings.js'
import * as vector from './props/vector.js'

export type PropTree = Map<string, PropDef | PropTree>

export type TypeDef = {
  id: number
  name: string
  main: PropDef[]
  separate: PropDef[]
  props: Map<string, PropDef>
  tree: PropTree
  schema: SchemaType<true>
  schemaRoot: SchemaOut
}

export type PropDef = {
  id: number
  type: PropTypeEnum
  start: number
  path: string[]
  size: number
  schema: SchemaProp<true>
  edges?: TypeDef
  ref?: TypeDef
  refProp?: PropDef
  typeDef: TypeDef
  isEdge: boolean
  pushValue(
    buf: AutoSizedUint8Array,
    value: unknown,
    op: ModifyEnum,
    lang?: LangCodeEnum,
  ): void

  write(
    buf: Uint8Array,
    val: any,
    offset: number,
    op?: ModifyEnum,
    lang?: LangCodeEnum,
  ): void

  pushSelvaSchema(buf: AutoSizedUint8Array): void
  validate(val: unknown, lang?: LangCodeEnum): void
}

export const isPropDef = (p: any): p is PropDef => {
  return p && 'pushValue' in p && typeof p.pushValue === 'function'
}

export type PropDefClass = {
  new (schema: SchemaProp<true>, path: string[], typeDef: TypeDef): PropDef
}

export const defs: Record<
  Exclude<SchemaProp<true>['type'], 'object'>,
  PropDefClass
> = {
  ...references,
  ...fixed,
  ...alias,
  ...binary,
  ...cardinality,
  ...strings,
  ...vector,
  enum: fixed.enum_,
}
