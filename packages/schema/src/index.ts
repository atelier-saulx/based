import type { DbPropDef, ObjPropDef, PropDef, TypeDef } from './def/index.js'
import {
  parseSchema,
  type Schema,
  type SchemaIn,
  type SchemaOut,
} from './schema/schema.js'

export type { Schema, SchemaIn, SchemaOut }
export * from './def/enums.js'
export * from './schema/lang.js'
export * from './def/index.js'

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
): IterableIterator<DbPropDef> {
  for (const key in def.props) {
    const propDef = def.props[key]

    if ('props' in propDef) {
      console.log('- obj')
      yield* getAllProps(propDef)
    } else if (!('target' in propDef)) {
      console.log('- prop')
      yield propDef
    }
  }
}

export const getProp = (typeDef: TypeDef, path: string[]): PropDef | void =>
  getPropChain(typeDef, path).at(-1)
