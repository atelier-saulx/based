import type { SchemaObject } from './object.ts'
import type { SchemaProp } from './prop.ts'
import type { SchemaReference } from './reference.ts'
import type { SchemaReferences } from './references.ts'
import type { Schema } from './schema.ts'
import type { SchemaString } from './string.ts'
import type { SchemaProps, SchemaType } from './type.ts'
import type { SchemaVector } from './vector.ts'

type DefBase = {
  id: number
  typeEnum: number
  path: string[]
  main?: {
    start: number
    size: number
  }
}

type RefLike = SchemaReference<true> | SchemaReferences<true>
type Obj = SchemaObject<true>

type PropDefRef = RefLike &
  DefBase & {
    inverse: PropDef
  }
type PropDefObj = Obj & {
  path: string[]
  props: Record<string, PropDef>
}
type PropDefRest = Exclude<Exclude<SchemaProp<true>, RefLike>, Obj> & DefBase
type PropDef = PropDefRef | PropDefObj | PropDefRest

type TypeDef = Omit<SchemaType<true>, 'props'> & {
  props: Record<string, PropDef>
  size: number
}

type Defs = Record<string | number, TypeDef>

const stringLen = ({ maxBytes = Infinity, max = Infinity }: SchemaString) =>
  maxBytes < 61 ? maxBytes + 1 : max < 31 ? max * 2 + 1 : 0
const numberLen = (type?: string) =>
  (type && Number(type.replace(/[^0-9]/g, '')) / 4) || 8

const propTypeEnums: Record<
  Exclude<SchemaProp<true>['type'], 'object'>,
  number
> = {
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

const propMainSizes: Partial<
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
  let idCnt = 0

  for (const type in schema.types) {
    defs[type] = parseType(schema.types[type])
  }

  for (const type in defs) {
    for (const prop in defs[type].props) {
      const propDef = defs[type].props[prop]
      if (propDef.type === 'reference') {
        propDef.inverse = defs[propDef.ref].props[propDef.prop]
        parseEdges(type, prop, propDef)
      } else if (propDef.type === 'references') {
        propDef.inverse = defs[propDef.items.ref].props[propDef.items.prop]
        parseEdges(type, prop, propDef.items)
      }
    }
  }

  return defs

  function parseType(typeSchema: SchemaType<true>) {
    const typeProps = {}
    let size = 0
    let propIdCnt = 1

    const props = parseProps(typeSchema.props, [], typeProps)

    return {
      id: idCnt++,
      size,
      ...typeSchema,
      props,
    }

    function parseProps(
      props: Record<string, SchemaProp<true>>,
      path: string[],
      propDefs: Record<string, PropDef>,
    ): Record<string, PropDef> {
      for (const prop in props) {
        const propSchema = props[prop]
        const { type: propType, ...rest } = propSchema
        const getSize = propMainSizes[propType]
        const mainSize =
          typeof getSize === 'function' ? getSize(propSchema) : getSize || 0
        const propPath = [...path, prop]
        let propDef: PropDef

        if (propType === 'object') {
          propDef = {
            type: propType,
            path: propPath,
            ...rest,
            props: parseProps(propSchema.props, propPath, {}),
          }
        } else {
          propDef = {
            id: mainSize ? 0 : propIdCnt++,
            type: propType,
            typeEnum: propTypeEnums[propType],
            path: propPath,
            ...rest,
          } as PropDef
        }

        if (mainSize) {
          size += mainSize
          ;(propDef as PropDefRest).main = {
            start: mainSize && size,
            size: mainSize,
          }
        }

        propDefs[prop] = propDef
        if (propDef.path.length > 1) {
          typeProps[propDef.path.join('.')] = propDef
        }
      }
      return propDefs
    }
  }

  function parseEdges(
    type: string,
    prop: string,
    refSchema: SchemaReference<true>,
  ) {
    const refType = refSchema.ref
    if (type > refType) {
      // we'll add it from the other side
      return
    }

    let edges: SchemaProps<true> | undefined
    for (const key in refSchema) {
      if (key[0] === '$') {
        edges ??= {}
        edges[key] = refSchema[key]
      }
    }

    if (!edges) {
      return
    }

    const edgeType = parseType({
      props: edges,
    })

    for (const key in edges) {
      // also add the paths on both sides for queries
      defs[type][`${prop}.${key}`] = edgeType.props[key]
    }

    defs[`$${type}_${prop}`] = edgeType
  }
}
