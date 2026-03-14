import { ReadLocales } from '../../protocol/index.js'
import {
  type SchemaOut,
  type SchemaProp,
  type SchemaProps,
  type SchemaType,
} from '../../schema/index.js'
import { LangCode, LangCodeEnum, PropType } from '../../zigTsExports.js'
import { defs, TypeDef, type PropDef, type PropTree } from './index.js'

const mainSorter = (a, b) => {
  if (a.size === 8) return -1
  if (a.size === 4 && b.size !== 8) return -1
  if (a.size === 2 && b.size !== 4 && b.size !== 8) return -1
  if (a.size === b.size) return 0
  return 1
}

export const propIndexOffset = (prop: PropDef): number => {
  switch (prop.type) {
    // We pack default on the beginning, for smallest possible mem
    case PropType.microBuffer:
    case PropType.vector:
      // microbuffers first
      return 'default' in prop.schema ? -600 : 0
    case PropType.string:
    case PropType.binary:
    case PropType.json:
      // then strings
      return 'default' in prop.schema ? -500 : 0
    // then text
    case PropType.stringLocalized:
      return 'default' in prop.schema ? -400 : 0
    // References go behind the defaults
    case PropType.references:
    case PropType.reference:
      return -300
    // Aliases and colVec go last
    case PropType.alias:
    case PropType.aliases: // TODO remove ALIASES
    case PropType.colVec:
      return 300
    default:
      return 0
  }
}

const separateSorter = (a: PropDef, b: PropDef) =>
  propIndexOffset(a) - propIndexOffset(b)

const addPropDef = (
  prop: SchemaProp<true>,
  path: string[],
  typeDef: TypeDef,
) => {
  const Def = defs[prop.type]
  if (!Def) {
    throw new Error('Unknown def: ' + prop.type)
  }

  const def: PropDef = new Def(prop, path, typeDef)
  if (def.size) {
    typeDef.main.push(def)
  } else {
    typeDef.separate.push(def)
  }
  return def
}

const getTypeDef = (
  name: string,
  schema: SchemaType<true>,
  schemaRoot: SchemaOut,
): TypeDef => {
  const { props } = schema
  const typeDef: TypeDef = new TypeDef(name, schema, schemaRoot)

  const walk = (
    props: SchemaProps<true>,
    pPath: string[],
    tree: TypeDef['tree'],
  ): boolean | undefined => {
    for (const key in props) {
      const prop = props[key]
      const path = [...pPath, key]
      let required = prop.required
      let def: PropTree | PropDef
      if (prop.type === 'object') {
        def = {
          path,
          schema: prop,
          props: new Map(),
          required: [],
        }
        if (walk(prop.props, path, def)) {
          required = true
        }
        tree.props.set(key, def)
      } else {
        def = addPropDef(prop, path, typeDef)
        typeDef.props.set(path.join('.'), def)
        tree.props.set(key, def)
      }
      if (required) {
        tree.required.push(key)
      }
      if (prop.hooks) {
        for (const key in typeDef.propHooks) {
          if (prop.hooks[key]) {
            typeDef.propHooks[key].push(def)
          }
        }
      }
    }
    return !!tree.required.length
  }

  walk(props, [], typeDef.tree)

  return typeDef
}

const localesFallbackCache = new WeakMap()
export const getLocaleFallbacks = (
  schema: SchemaOut,
): { [code: string]: LangCodeEnum[] } => {
  if (!schema.locales) {
    return {}
  }
  const cached = localesFallbackCache.get(schema.locales)
  if (cached) return cached
  const locales = {
    [LangCode.none]: [],
  }
  for (const lang in schema.locales) {
    const { fallback } = schema.locales[lang as keyof typeof schema.locales]!
    locales[LangCode[lang]] = fallback.map((lang) => LangCode[lang])
  }
  localesFallbackCache.set(schema.locales, cached)
  return locales
}

export const getReadLocales = (schema: SchemaOut): ReadLocales => {
  const locales: ReadLocales = {}
  for (const lang in schema.locales) {
    locales[LangCode[lang]] = lang
  }
  return locales
}

const localesReadSchemaCache = new WeakMap()
export const getLocaleReadSchema = (schema: SchemaOut): ReadLocales => {
  if (!schema.locales) {
    return {}
  }
  const cached = localesReadSchemaCache.get(schema.locales)
  if (cached) return cached
  const locales = {}
  for (const lang in schema.locales) {
    locales[LangCode[lang]] = lang
  }
  localesReadSchemaCache.set(schema.locales, cached)
  return locales
}

const cache = new WeakMap()
export const getTypeDefs = (schema: SchemaOut): Map<string, TypeDef> => {
  const cached = cache.get(schema)
  if (cached) return cached
  const typeDefs = new Map(
    Object.entries(schema.types)
      .sort()
      .map(([name, type]) => [name, getTypeDef(name, type, schema)]),
  )

  // -------- connect references, add edges and assign ids --------
  let typeId = 1
  for (const [typeName, typeDef] of typeDefs) {
    typeDef.id = typeId++
    for (const [propPath, def] of typeDef.props) {
      const prop =
        def.schema.type === 'references' ? def.schema.items : def.schema
      if (prop.type !== 'reference') continue
      def.ref = typeDefs.get(prop.ref)!
      if (prop.prop) {
        def.refProp = def.ref.props.get(prop.prop)!
      } else {
        def.refProp = addPropDef(
          {
            type: 'references',
            items: {
              type: 'reference',
              ref: typeName,
              prop: propPath,
            },
          },
          [`${typeName}.${propPath}`],
          def.ref,
        )
        def.refProp.ref = typeDef
        def.refProp.refProp = def
      }
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
        const edgeTypeName = `_${typeName}.${propPath}`
        def.edges = getTypeDef(edgeTypeName, { props: edges }, schema)
        for (const [, edgePropDef] of def.edges.props) {
          edgePropDef.isEdge = true
        }
        typeDefs.set(edgeTypeName, def.edges)
      }
    }
  }

  for (const [, typeDef] of typeDefs) {
    // -------- sort and assign main --------
    typeDef.main.sort(mainSorter)
    let start = 0
    for (const prop of typeDef.main) {
      prop.start = start
      start += prop.size
    }

    // -------- sort and assign separate ---------
    typeDef.separate.sort(separateSorter)
    let propId = 1
    for (const prop of typeDef.separate) {
      prop.id = propId++
    }
  }

  // ----------- add to cache --------
  cache.set(schema, typeDefs)
  return typeDefs
}
