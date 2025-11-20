import type { SchemaObject } from './object.js'
import type { SchemaProp } from './prop.js'
import type { SchemaReference } from './reference.js'
import type { SchemaReferences } from './references.js'
import type { Schema } from './schema.js'
import type { SchemaString } from './string.js'
import type { SchemaProps, SchemaType } from './type.js'
import type { SchemaVector } from './vector.js'

type BaseProp = {
  root: TypeDef
  path: string[]
}

type DbProp = BaseProp & {
  id: number
  typeEnum: number
  main?: {
    start: number
    size: number
  }
}

type RefLike = SchemaReference<true> | SchemaReferences<true>
type Obj = SchemaObject<true>

type PropDefRef = RefLike &
  DbProp & {
    target: PropDef
  }

type PropDefObj = Obj &
  BaseProp & {
    props: Record<string, PropDef>
  }

type PropDefRest = Exclude<Exclude<SchemaProp<true>, RefLike>, Obj> & DbProp
type PropDef = PropDefRef | PropDefObj | PropDefRest

type TypeDef = Omit<SchemaType<true>, 'props'> & {
  id: number
  size: number
  props: Record<string, PropDef>
  edge?: true
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
      if (propDef.type === 'reference' || propDef.type === 'references') {
        parseRefLike(type, prop, propDef)
      }
    }
  }

  return defs

  function parseType(typeSchema: SchemaType<true>) {
    const typeProps = {}
    let propIdCnt = 1

    const root = {
      id: idCnt++,
      size: 0,
      ...typeSchema,
    } as TypeDef

    root.props = parseProps(typeSchema.props, [], typeProps)

    return root

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
            root,
            ...rest,
            props: parseProps(propSchema.props, propPath, {}),
          }
        } else {
          propDef = {
            id: mainSize ? 0 : propIdCnt++,
            type: propType,
            typeEnum: propTypeEnums[propType],
            root,
            path: propPath,
            ...rest,
          } as PropDef
        }

        if (mainSize) {
          root.size += mainSize
          ;(propDef as PropDefRest).main = {
            start: mainSize && root.size,
            size: mainSize,
          }
        }

        propDefs[prop] = propDef
        // if (propDef.path.length > 1) {
        //   typeProps[propDef.path.join('.')] = propDef
        // }
      }
      return propDefs
    }
  }

  function parseRefLike(type: string, prop: string, refDef: PropDefRef) {
    const refSchema = 'items' in refDef ? refDef.items : refDef
    const refType = refSchema.ref
    const targetDef = defs[refType].props[refSchema.prop]

    // add target props
    refDef.target = targetDef

    if (type > refType) {
      // we'll handle the edges from the other side
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

    const targetSchema = 'items' in targetDef ? targetDef.items : targetDef
    const edgeType = parseType({ props: edges })

    for (const key in edges) {
      const edgeProp = edgeType.props[key]
      // // add dot path on both types
      // defs[type].props[`${prop}.${key}`] = edgeProp
      // defs[refType].props[`${targetDef.path.join('.')}.${key}`] = edgeProp

      // add ref on both sides
      refSchema[key] = edgeProp
      targetSchema[key] = edgeProp
    }

    // only need to store this on one side
    defs[`$${type}_${prop}`] = edgeType
    edgeType.edge = true
  }
}
