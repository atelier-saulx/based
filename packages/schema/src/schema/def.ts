import type { SchemaProp } from './prop.ts'
import type { Schema } from './schema.ts'
import type { SchemaString } from './string.ts'
import type { SchemaType } from './type.ts'
import type { SchemaVector } from './vector.ts'

type PropDef = SchemaProp<true> & {
  propId: number
  typeId: number
  // seperate => propId === 0
  path: string[]
  start: number
  len: number // rename to size?
  props: Record<string, PropDef>
  inverse?: PropDef // this replaces inverseTypeName, inversePropName, inversePropNumber
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

const typeIds: Record<SchemaProp<true>['type'], number> = {
  alias: 18,
  binary: 25,
  boolean: 9,
  cardinality: 5,
  colvec: 30,
  enum: 10,
  int16: 21,
  int32: 23,
  int8: 20,
  json: 28,
  number: 4,
  object: 29,
  reference: 13,
  references: 14,
  string: 11,
  text: 12,
  timestamp: 1,
  uint8: 6,
  uint16: 22,
  uint32: 7,
  vector: 27,
} as const

const typeLengths: Partial<
  Record<
    SchemaProp<true>['type'],
    number | ((propSchema: SchemaProp<true>) => number)
  >
> = {
  boolean: 1,
  enum: 1,
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  number: 8,
  timestamp: 8,

  alias: stringLen,
  binary: stringLen,
  string: stringLen,
  cardinality: stringLen,
  colvec: ({ size, baseType }: SchemaVector) => size * numberLen(baseType),
  vector: ({ size }: SchemaVector) => size * 4,
}

export const schemaToDefs = (schema: Schema<true>): Defs => {
  const defs: Defs = {}
  // init loop
  for (const type in schema.types) {
    const typeSchema = schema.types[type]
    const typeProps = {}
    let mainLen = 0
    let propIdCnt = 1

    const parseProps = (
      props: Record<string, SchemaProp<true>>,
      path: string[],
      propDefs: Record<string, PropDef>,
    ): Record<string, PropDef> => {
      for (const prop in props) {
        const propSchema = props[prop]
        const len = typeLengths[propSchema.type]
        const propLen = typeof len === 'function' ? len(propSchema) : len || 0
        const propPath = [...path, prop]
        const propDef: PropDef = {
          ...propSchema,
          propId: propLen ? 0 : propIdCnt++,
          typeId: typeIds[propSchema.type],
          path: propPath,
          start: propLen && mainLen,
          len: propLen,
          props:
            'props' in propSchema
              ? parseProps(propSchema.props, propPath, {})
              : {},
        }

        mainLen += propLen
        propDefs[prop] = propDef
        if (propPath.length > 1) {
          typeProps[propPath.join('.')] = propDef
        }
      }
      return propDefs
    }

    const typeDef: TypeDef = {
      ...typeSchema,
      props: parseProps(typeSchema.props, [], typeProps),
      mainLen,
    }

    defs[type] = typeDef
  }

  // post parse
  for (const type in defs) {
    for (const prop in defs[type].props) {
      const propDef = defs[type].props[prop]
      if (propDef.type === 'reference') {
        propDef.inverse = defs[propDef.ref].props[propDef.prop]
      }
    }
  }

  return defs
}
