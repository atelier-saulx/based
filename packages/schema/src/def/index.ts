import type { SchemaEnum } from '../schema/enum.js'
import type { SchemaObject } from '../schema/object.js'
import type { SchemaProp } from '../schema/prop.js'
import type { SchemaReference } from '../schema/reference.js'
import type { SchemaReferences } from '../schema/references.js'
import type { SchemaLocale, SchemaOut } from '../schema/schema.js'
import type { SchemaString } from '../schema/string.js'
import type { SchemaProps, SchemaType } from '../schema/type.js'
import type { SchemaVector } from '../schema/vector.js'
import { getValidator, type Validation } from './validation.js'
import type { SchemaPropHooks } from '../schema/hooks.js'
import type { LangName } from '../schema/lang.js'
import { typeIndexMap, type TypeIndex, type TypeName } from './enums.js'
import type { Base } from '../schema/base.js'

type BaseProp = Base & {
  typeDef: TypeDef
  path: string[]
  validation: Validation
}

type DbProp = BaseProp & {
  id: number
  typeIndex: TypeIndex
}

type IdPropDef = DbProp & {
  type: 'id'
  id: 255
  typeIndex: typeof typeIndexMap.null
}

// type MicroBufferPropDef = DbProp & {
//   type: 'microbuffer'
//   id: 0
//   typeIndex: typeof typeIndexMap.microbuffer
//   main: {
//     start: 0
//     size: number
//   }
// }

type ErrorPropDef = BaseProp & {
  type: 'error'
  id: -1
  typeIndex: -1
}

type EnumPropDef = DbProp &
  SchemaEnum<true> & {
    enumMap: Record<string, number>
  }

type RefLike = SchemaReference<true> | SchemaReferences<true>

export type ObjPropDef = SchemaObject<true> &
  BaseProp & { props: Record<string, PropDef> }

type VectorPropDef = SchemaVector & DbProp & { baseSize: number }
type PropDefRest = Exclude<
  SchemaProp<true>,
  RefLike | SchemaObject<true> | SchemaEnum<true> | SchemaVector
> &
  DbProp

export type RefPropDef = RefLike &
  DbProp & { target: RefPropDef; edgesDef?: TypeDef }

export type SeparateDef = RefPropDef | PropDefRest | EnumPropDef | VectorPropDef
export type MainDef = SeparateDef & {
  main: {
    start: number
    size: number
  }
}
export type LeafDef = SeparateDef | MainDef
export type PropDef = ObjPropDef | LeafDef
export type QueryPropDef = LeafDef | IdPropDef // | ErrorPropDef

export type TypeDef = Omit<SchemaType<true>, 'props'> & {
  id: number
  name: string
  size: number
  props: Record<string, PropDef>
  edge?: true
  separate: SeparateDef[]
  propHooks: Partial<Record<keyof SchemaPropHooks, PropDef[]>>
  locales: Partial<Record<LangName, SchemaLocale>>
  queryProps: { id: IdPropDef; [key: string]: QueryPropDef }
  dbProps: { [key: string]: LeafDef }
}
export type BranchDef = TypeDef | ObjPropDef
export type TypeDefs = {
  byName: Record<string, TypeDef>
  byId: Record<number, TypeDef>
}

const stringLen = ({ maxBytes = Infinity, max = Infinity }: SchemaString) =>
  maxBytes < 61 ? maxBytes + 1 : max < 31 ? max * 2 + 1 : 0

const numberLen = (type?: string) =>
  (type && Number(type.replace(/[^0-9]/g, '')) / 4) || 8

type SizeMap = Partial<
  Record<TypeName, number | ((propSchema: SchemaProp<true>) => number)>
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

export const createIdProp = (typeDef: TypeDef): IdPropDef => ({
  id: 255,
  type: 'id',
  typeIndex: 0,
  path: ['id'],
  typeDef,
  validation: () => true,
})

export const createErrorProp = (typeDef: TypeDef): ErrorPropDef => ({
  id: -1,
  type: 'error',
  typeIndex: -1,
  path: [],
  typeDef,
  validation: () => true,
})

const sortMainProps = (a: LeafDef, b: LeafDef) => {
  const sizeA = ('main' in a && a.main.size) || 0
  const sizeB = ('main' in b && b.main.size) || 0
  if (sizeA === 8) {
    return -1
  }
  if (sizeA === 4 && sizeB !== 8) {
    return -1
  }
  if (sizeA === sizeB) {
    return 0
  }
  return 1
}

const sortDbPropOrder = ({ type }) => {
  if (type === 'reference' || type === 'references') {
    return -1
  }
  if (type === 'alias' || type === 'colvec') {
    return 300
  }
  return 299
}

export const schemaToTypeDefs = (schema: SchemaOut): TypeDefs => {
  const defs: TypeDefs = {
    byName: {},
    byId: {},
  }

  let idCnt = 0

  const locales = {}
  for (const lang in schema.locales) {
    const v = schema.locales[lang]
    locales[lang] = typeof v === 'object' ? v : {}
  }

  for (const type in schema.types) {
    const typeDef = parseType(type, schema.types[type])
    defs.byName[type] = typeDef
    defs.byId[typeDef.id] = typeDef
  }

  for (const type in defs.byName) {
    for (const prop in defs.byName[type].props) {
      const propDef = defs.byName[type].props[prop]
      if ('target' in propDef) {
        parseRefLike(type, prop, propDef)
      }
    }
  }

  return defs

  function parseType(name: string, typeSchema: SchemaType<true>): TypeDef {
    const typeProps = {}
    const typeDef = {
      ...typeSchema,
      id: idCnt++,
      name,
      size: 0,
      propHooks: {},
      locales,
      props: {},
      dbProps: {},
    } as TypeDef

    typeDef.separate = []
    typeDef.queryProps = {} as typeof typeDef.queryProps
    typeDef.props = parseProps(typeSchema.props, typeProps, [])
    typeDef.queryProps.id = createIdProp(typeDef)

    const sorted = Object.values(typeDef.dbProps).sort(sortDbPropOrder)

    let propIdCnt = 1
    for (const prop of sorted) {
      if (!('main' in prop)) {
        prop.id = propIdCnt++
      }
    }

    sorted.sort(sortMainProps)
    let start = 0
    for (const prop of sorted) {
      if ('main' in prop) {
        prop.main.start = start
        start += prop.main.size
      }
    }

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
          id: 0, // temporary id because we have to sort before giving id later
          type: propType,
          typeIndex: typeIndexMap[propType],
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
          propDef.baseSize = 4
        } else if (propDef.type === 'colvec') {
          propDef.baseSize = numberLen(propDef.baseType)
        }

        if (mainSize) {
          typeDef.size += mainSize
          ;(propDef as MainDef).main = {
            start: 0, // temporary start because we have to sort before giving start later
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

        const dotPath = propDef.path.join('.')
        typeDef.queryProps[dotPath] = propDef
        typeDef.dbProps[dotPath] = propDef
        defProps[prop] = propDef
      }
      return defProps
    }
  }

  function parseRefLike(type: string, prop: string, refDef: RefPropDef) {
    const refSchema = 'items' in refDef ? refDef.items : refDef
    const refType = refSchema.ref
    const target = defs.byName[refType].props[refSchema.prop] as RefPropDef

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

    defs.byName[edgeTypeName] = edgeType
    edgeType.edge = true
  }
}
