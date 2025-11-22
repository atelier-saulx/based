import type { LeafDef, ObjPropDef, PropDef, TypeDef } from './def/index.js'
import type { SchemaHooks } from './schema/hooks.js'
import type { numberTypes } from './schema/number.js'
import type { SchemaProp } from './schema/prop.js'
import {
  parseSchema,
  type Schema,
  type SchemaIn,
  type SchemaMigrateFns,
  type SchemaOut,
} from './schema/schema.js'
import type { SchemaProps, SchemaType } from './schema/type.js'

export * from './def/enums.js'
export * from './schema/lang.js'
export * from './def/index.js'
export * from './def/validation.js'
export * as semver from './semver/mod.js'
export { type SchemaVector } from './schema/vector.js'
export { type SchemaTimestamp } from './schema/timestamp.js'
export { type SchemaCardinality } from './schema/cardinality.js'
export { type SchemaBinary } from './schema/binary.js'
export { type SchemaBoolean } from './schema/boolean.js'
export { type SchemaString } from './schema/string.js'
export { type SchemaNumber, numberTypes } from './schema/number.js'
export { type SchemaAlias } from './schema/alias.js'
export { type SchemaEnum } from './schema/enum.js'
export * from './serialize.js'

export type {
  Schema,
  SchemaIn,
  SchemaOut,
  SchemaMigrateFns,
  SchemaProps,
  SchemaProp,
  SchemaType,
  SchemaHooks,
}

export const parse = (input: SchemaIn): { schema: SchemaOut } => {
  const schema = parseSchema(input)
  return { schema }
}

export const getPropChain = (
  typeDef: TypeDef,
  path: string[],
): (PropDef | void)[] => {
  let next: TypeDef | PropDef | void = typeDef
  return path.map((key) => {
    if (next) {
      if (key[0] === '$') {
        next = 'items' in next ? next.items[key] : next[key]
      } else if ('props' in next) {
        next = next.props[key]
      } else if ('target' in next) {
        next = next.target.typeDef.props[key]
      } else {
        next = undefined
      }
    }
    return next as any
  })
}

export function* getAllProps(
  def: ObjPropDef | TypeDef,
): IterableIterator<LeafDef> {
  for (const key in def.props) {
    const propDef = def.props[key]

    if ('props' in propDef) {
      yield* getAllProps(propDef)
    } else if (!('target' in propDef)) {
      yield propDef
    }
  }
}

export const getProp = (typeDef: TypeDef, path: string[]): PropDef | void =>
  getPropChain(typeDef, path).at(-1)
