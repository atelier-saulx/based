import {
  type SchemaOut,
  type SchemaProp,
  type SchemaProps,
  type SchemaType,
} from '../../../schema.js'
import { reorderProps } from '../../../schema/def/utils.js'
import { PropType } from '../../../zigTsExports.js'
import { defs, type PropDef, type PropDefClass, type TypeDef } from './index.js'

const mainSorter = (a, b) => {
  if (a.size === 8) return -1
  if (a.size === 4 && b.size !== 8) return -1
  if (a.size === b.size) return 0
  return 1
}

const propIndexOffset = (prop: PropDef) => {
  switch (prop.type) {
    case PropType.microBuffer:
    case PropType.vector:
      return 'default' in prop.prop ? -600 : 0
    case PropType.string:
    case PropType.binary:
    case PropType.json:
      return 'default' in prop.prop ? -500 : 0
    case PropType.text:
      return 'default' in prop.prop ? -400 : 0
    case PropType.references:
    case PropType.reference:
      return -300
    case PropType.alias:
    case PropType.aliases:
    case PropType.colVec:
      return 300
    default:
      return 0
  }
}

const separateSorter = (a, b) => propIndexOffset(a) - propIndexOffset(b)

const getTypeDef = ({ props }: SchemaType<true>): TypeDef => {
  const typeDef: TypeDef = {
    id: 0,
    separate: [],
    props: new Map(),
    main: [],
    tree: new Map(),
  }

  const walk = (
    props: SchemaProps<true>,
    pPath: string[],
    tree: TypeDef['tree'],
  ): void => {
    for (const key in props) {
      const prop = props[key]
      const path = [...pPath, key]
      if (prop.type === 'object') {
        const branch = new Map()
        walk(prop.props, path, branch)
        tree.set(key, branch)
        continue
      }

      const Def = defs[prop.type]
      if (!Def) {
        console.error('unknown def')
        // TODO: handle missing type
        continue
      }

      const def = new Def(prop, path)
      if (def.size) {
        typeDef.main.push(def)
      } else {
        typeDef.separate.push(def)
      }
      typeDef.props.set(path.join('.'), def)
      tree.set(key, def)
    }
  }

  walk(props, [], typeDef.tree)

  // -------- finish main --------
  typeDef.main.sort(mainSorter)
  let start = 0
  for (const prop of typeDef.main) {
    prop.start = start
    start += prop.size
  }

  // -------- finish separate ---------
  typeDef.separate.sort(separateSorter)
  let propId = 1
  for (const prop of typeDef.separate) {
    prop.id = propId++
  }

  return typeDef
}

const cache = new WeakMap()
export const getTypeDefs = (schema: SchemaOut): Map<string, TypeDef> => {
  const cached = cache.get(schema)
  if (cached) return cached
  const typeDefs = new Map(
    Object.entries(schema.types)
      .sort()
      .map(([key, type]) => [key, getTypeDef(type)]),
  )

  // -------- connect references, add edges and assign ids --------
  let typeId = 1
  for (const [typeName, typeDef] of typeDefs) {
    typeDef.id = typeId++
    for (const [propPath, def] of typeDef.props) {
      const prop = def.prop.type === 'references' ? def.prop.items : def.prop
      if (prop.type !== 'reference') continue
      def.ref = typeDefs.get(prop.ref)!
      if (!prop.prop) {
        continue
      }
      def.refProp = def.ref.props.get(prop.prop)!
      const inverseEdges = def.refProp.edges
      if (inverseEdges) {
        def.edges = inverseEdges
        continue
      }
      let edges: undefined | Record<string, SchemaProp<true>>
      for (const edge in prop) {
        if (edge[0] !== '$') continue
        edges ??= {}
        edges[edge] = prop[edge]
      }
      if (edges) {
        def.edges = getTypeDef({ props: edges })
        const edgeTypeName = `_${typeName}.${propPath}`
        typeDefs.set(edgeTypeName, def.edges)
      }
    }
  }

  // ----------- add to cache --------
  cache.set(schema, typeDefs)

  return typeDefs
}
