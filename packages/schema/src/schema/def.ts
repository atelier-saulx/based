import type { SchemaProp } from './prop.ts'
import type { Schema } from './schema.ts'
import type { SchemaString } from './string.ts'
import type { SchemaType } from './type.ts'
import type { SchemaVector } from './vector.ts'

type PropDef = Omit<SchemaProp<true>, 'props'> & {
  propId: number
  typeId: number
  // seperate => propId === 0
  path: string[]
  start: number
  len: number // rename to size?
  refProp?: PropDef // this replaces inverseTypeName, inversePropName, inversePropNumber
  props?: Record<string, PropDef>
}

type TypeDef = Omit<SchemaType<true>, 'props'> & {
  props: Record<string, PropDef>
  mainLen: number
}

type Defs = Record<string | number, TypeDef>

const stringLen = ({ maxBytes = Infinity, max = Infinity }: SchemaString) =>
  maxBytes < 61 ? maxBytes + 1 : max < 31 ? max * 2 + 1 : 0
const numberLen = (type?: string) =>
  (type && Number(type.replace(/[^0-9]/g, '')) / 4) || 8

const types: Record<
  SchemaProp<true>['type'],
  {
    id: number
    len?: number | ((propSchema: SchemaProp<true>) => number)
  }
> = {
  alias: { id: 18, len: stringLen },
  binary: { id: 25, len: stringLen },
  boolean: { id: 9, len: 1 },
  cardinality: { id: 5, len: stringLen },
  colvec: {
    id: 30,
    len: ({ size, baseType }: SchemaVector) => size * numberLen(baseType),
  },
  enum: { id: 10, len: 1 },
  int16: { id: 21, len: 2 },
  int32: { id: 23, len: 4 },
  int8: { id: 20, len: 1 },
  json: { id: 28 },
  number: { id: 4, len: 8 },
  object: { id: 29 },
  reference: { id: 13 },
  references: { id: 14 },
  string: {
    id: 11,
    len: stringLen,
  },
  text: { id: 12 },
  timestamp: { id: 1, len: 8 },
  uint8: { id: 6, len: 1 },
  uint16: { id: 22, len: 2 },
  uint32: { id: 7, len: 4 },
  vector: { id: 27, len: ({ size }: SchemaVector) => size * 4 },
} as const

export const schemaToDefs = (schema: Schema<true>): Defs => {
  const defs: Defs = {}
  for (const type in schema.types) {
    const typeSchema = schema.types[type]
    let propId = 1

    const parseProps = (
      props: Record<string, SchemaProp<true>>,
      path = [],
    ): Record<string, PropDef> => {
      const defs = {}
      for (const prop in props) {
        const propSchema = props[prop]
        const { id, len } = types[propSchema.type]
        const propLen = typeof len === 'function' ? len(propSchema) : len || 0
        const propDef: PropDef = {
          ...propSchema,
          propId: propLen ? 0 : propId++,
          typeId: id,
          path: [...path, prop],
          start: propLen && typeDef.mainLen,
          len: propLen,
          props: 'props' in propSchema ? parseProps(propSchema.props) : {},
        }

        defs[prop] = propDef
      }
      return defs
    }

    const typeDef: TypeDef = {
      ...typeSchema,
      props: parseProps(typeSchema.props),
      mainLen: 0,
    }

    defs[type] = typeDef
  }

  return defs
}
