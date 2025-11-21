import { typeMap, type Type } from './enums.js'
import type { SchemaEnum } from '../schema/enum.js'
import type { SchemaObject } from '../schema/object.js'
import type { SchemaProp } from '../schema/prop.js'
import type { SchemaReference } from '../schema/reference.js'
import type { SchemaReferences } from '../schema/references.js'
import type { SchemaOut } from '../schema/schema.js'
import type { SchemaString } from '../schema/string.js'
import type { SchemaProps, SchemaType } from '../schema/type.js'
import type { SchemaVector } from '../schema/vector.js'
import { getValidator, type Validation } from './validation.js'

type BaseProp = {
  typeDef: TypeDef
  path: string[]
  validation: Validation
}

type DbProp = BaseProp & {
  id: number
  typeEnum: number
  main?: {
    start: number
    size: number
  }
}

type EnumPropDef = DbProp &
  SchemaEnum<true> & {
    enumMap: Record<string, number>
  }

type RefLike = SchemaReference<true> | SchemaReferences<true>

type PropDefRest = Exclude<
  SchemaProp<true>,
  RefLike | SchemaObject<true> | SchemaEnum<true>
> &
  DbProp

export type ObjPropDef = SchemaObject<true> &
  BaseProp & { props: Record<string, PropDef> }
export type RefPropDef = RefLike &
  DbProp & { target: PropDef; edgeDef?: TypeDef }
export type DbPropDef = RefPropDef | PropDefRest | EnumPropDef
export type PropDef = ObjPropDef | DbPropDef
export type TypeDef = Omit<SchemaType<true>, 'props'> & {
  id: number
  name: string
  size: number
  props: Record<string, PropDef>
  edge?: true
}

type Defs = Record<string | number, TypeDef>

const stringLen = ({ maxBytes = Infinity, max = Infinity }: SchemaString) =>
  maxBytes < 61 ? maxBytes + 1 : max < 31 ? max * 2 + 1 : 0
const numberLen = (type?: string) =>
  (type && Number(type.replace(/[^0-9]/g, '')) / 4) || 8

const propMainSizes: Partial<
  Record<Type, number | ((propSchema: SchemaProp<true>) => number)>
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
  vector: ({ size }: SchemaVector) => size * 4,
  colvec: ({ size, baseType }: SchemaVector) => size * numberLen(baseType),
}

export const schemaToDefs = (schema: SchemaOut): Defs => {
  const defs: Defs = {}
  let idCnt = 0

  for (const type in schema.types) {
    defs[type] = parseType(type, schema.types[type])
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

  function parseType(name: string, typeSchema: SchemaType<true>) {
    const typeProps = {}
    let propIdCnt = 1

    const typeDef = {
      id: idCnt++,
      name,
      size: 0,
      ...typeSchema,
    } as TypeDef

    typeDef.props = parseProps(typeSchema.props, [], typeProps)

    return typeDef

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
        const validation = getValidator(propSchema)
        let propDef: PropDef

        if (propType === 'object') {
          propDef = {
            type: propType,
            path: propPath,
            typeDef,
            ...rest,
            props: parseProps(propSchema.props, propPath, {}),
            validation,
          }
        } else {
          propDef = {
            id: mainSize ? 0 : propIdCnt++,
            type: propType,
            typeEnum: typeMap[propType],
            typeDef,
            path: propPath,
            ...rest,
            validation,
          } as PropDef

          if ('enum' in propDef) {
            propDef.enumMap = Object.fromEntries(
              propDef.enum.map((val, index) => [val, index + 1]),
            )
          }

          if (mainSize) {
            typeDef.size += mainSize
            ;(propDef as PropDefRest).main = {
              start: mainSize && typeDef.size,
              size: mainSize,
            }
          }
        }

        propDefs[prop] = propDef
      }
      return propDefs
    }
  }

  function parseRefLike(type: string, prop: string, refDef: RefPropDef) {
    const refSchema = 'items' in refDef ? refDef.items : refDef
    const refType = refSchema.ref
    const target = defs[refType].props[refSchema.prop] as RefPropDef

    refDef.target = target

    if (type > refType) return

    let edges: SchemaProps<true> | undefined
    for (const key in refSchema) {
      if (key[0] === '$') {
        edges ??= {}
        edges[key] = refSchema[key]
      }
    }

    if (!edges) return

    const targetSchema = 'items' in target ? target.items : target
    const edgeTypeName = `$${type}_${prop}`
    const edgeType = parseType(edgeTypeName, { props: edges })

    for (const key in edges) {
      const edgeProp = edgeType.props[key]
      refSchema[key] = edgeProp
      targetSchema[key] = edgeProp
      refDef.edgeDef = edgeType
      target.edgeDef = edgeType
    }

    defs[edgeTypeName] = edgeType
    edgeType.edge = true
  }
}
