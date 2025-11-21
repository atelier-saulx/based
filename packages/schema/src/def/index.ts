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
import type { SchemaPropHooks } from '../schema/hooks.js'

type BaseProp = {
  typeDef: TypeDef
  path: string[]
  validation: Validation
}

type DbProp = BaseProp & {
  id: number
  typeEnum: number
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
  DbProp & { target: PropDef; edgesDef?: TypeDef }

export type SeparateDef = RefPropDef | PropDefRest | EnumPropDef
export type MainDef = SeparateDef & {
  main: {
    start: number
    size: number
  }
}
export type LeafDef = SeparateDef | MainDef
export type PropDef = ObjPropDef | LeafDef
export type TypeDef = Omit<SchemaType<true>, 'props'> & {
  id: number
  name: string
  size: number
  props: Record<string, PropDef>
  edge?: true
  separate: SeparateDef[]
  propHooks: Partial<Record<keyof SchemaPropHooks, PropDef[]>>
}
export type BranchDef = TypeDef | ObjPropDef
export type TypeDefs = Record<string | number, TypeDef>

const stringLen = ({ maxBytes = Infinity, max = Infinity }: SchemaString) =>
  maxBytes < 61 ? maxBytes + 1 : max < 31 ? max * 2 + 1 : 0

const numberLen = (type?: string) =>
  (type && Number(type.replace(/[^0-9]/g, '')) / 4) || 8

type SizeMap = Partial<
  Record<Type, number | ((propSchema: SchemaProp<true>) => number)>
>

export const mainSizeMap = {
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
  binary: stringLen,
  string: stringLen,
} as const satisfies SizeMap

export const sizeMap = {
  // cardinality: stringLen,
  vector: ({ size }: SchemaVector) => size * 4,
  colvec: ({ size, baseType }: SchemaVector) => size * numberLen(baseType),
} as const satisfies SizeMap

export const schemaToTypeDefs = (schema: SchemaOut): TypeDefs => {
  const defs: TypeDefs = {}
  let idCnt = 0

  for (const type in schema.types) {
    defs[type] = parseType(type, schema.types[type])
  }

  for (const type in defs) {
    for (const prop in defs[type].props) {
      const propDef = defs[type].props[prop]
      if ('target' in propDef) {
        parseRefLike(type, prop, propDef)
      }
    }
  }

  for (const type in defs) {
    const typeDef = defs[type]
    defs[typeDef.id] = typeDef
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

    typeDef.separate = []
    typeDef.propHooks = {}
    typeDef.props = parseProps(typeSchema.props, typeProps, [])

    return typeDef

    function parseProps(
      schemaProps: Record<string, SchemaProp<true>>,
      defProps: Record<string, PropDef>,
      path: string[],
    ): Record<string, PropDef> {
      for (const prop in schemaProps) {
        const propSchema = schemaProps[prop]
        const { type: propType, ...rest } = propSchema
        const propPath = [...path, prop]
        const validation = getValidator(propSchema)

        if (propType === 'object') {
          defProps[prop] = {
            type: propType,
            path: propPath,
            typeDef,
            ...rest,
            props: parseProps(propSchema.props, {}, propPath),
            validation,
          }
          continue
        }

        const getMainSize = mainSizeMap[propType]
        const mainSize =
          typeof getMainSize === 'function'
            ? getMainSize(propSchema)
            : getMainSize || 0

        const propDef = {
          id: mainSize ? 0 : propIdCnt++,
          type: propType,
          typeEnum: typeMap[propType],
          typeDef,
          path: propPath,
          ...rest,
          validation,
        } as LeafDef

        if ('enum' in propDef) {
          propDef.enumMap = Object.fromEntries(
            propDef.enum.map((val, index) => [val, index + 1]),
          )
        } else if (propDef.type === 'vector') {
          propDef.size *= 4
        } else if (propDef.type === 'colvec') {
          propDef.size *= numberLen(propDef.baseType)
        }

        if (mainSize) {
          typeDef.size += mainSize
          ;(propDef as MainDef).main = {
            start: mainSize && typeDef.size,
            size: mainSize,
          }
        } else {
          typeDef.separate.push(propDef)
        }

        if (propDef.hooks) {
          for (const key in propDef.hooks) {
            typeDef.propHooks[key] ??= []
            typeDef.propHooks[key].push(propDef)
          }
        }

        defProps[prop] = propDef
      }
      return defProps
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
      refDef.edgesDef = edgeType
      target.edgesDef = edgeType
    }

    defs[edgeTypeName] = edgeType
    edgeType.edge = true
  }
}
