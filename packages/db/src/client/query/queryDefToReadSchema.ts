// import type { IncludeOpts, QueryDef, Target } from '@based/db'
import {
  inverseLangMap,
  langCodesMap,
  typeIndexMap,
  type LangCode,
  type QueryPropDef,
  type PropDef,
  type SchemaVector,
} from '@based/schema'
import {
  ReaderLocales,
  ReaderMeta,
  ReaderPropDef,
  ReaderSchema,
  ReaderSchemaEnum,
  VectorBaseType,
} from '@based/protocol/db-read'
import { IncludeOpts, QueryDef, Target } from './types.js'

const schemaVectorBaseTypeToEnum = (
  vector: SchemaVector['baseType'],
): VectorBaseType => {
  switch (vector) {
    case 'int8':
      return VectorBaseType.Int8
    case 'uint8':
      return VectorBaseType.Uint8
    case 'int16':
      return VectorBaseType.Int16
    case 'uint16':
      return VectorBaseType.Uint16
    case 'int32':
      return VectorBaseType.Int32
    case 'uint32':
      return VectorBaseType.Uint32
    case 'float32':
      return VectorBaseType.Float32
    case 'float64':
      return VectorBaseType.Float64
    case 'number':
      return VectorBaseType.Float64
  }
}

const createReaderPropDef = (
  p: QueryPropDef,
  locales: ReaderLocales,
  opts?: IncludeOpts,
): ReaderPropDef => {
  console.warn('TODO: handle edges in createReaderPropDef')
  const readerPropDef: ReaderPropDef = {
    path: p.path, //p.__isEdge ? p.path.slice(1) : p.path,
    typeIndex: opts?.raw ? typeIndexMap.binary : p.typeIndex,
    readBy: 0,
  }
  if (opts?.meta) {
    readerPropDef.meta =
      opts?.meta === 'only' ? ReaderMeta.only : ReaderMeta.combined
  }
  if (p.type === 'enum') {
    readerPropDef.enum = p.enum
  }
  if (p.type === 'vector' || p.type === 'colvec') {
    readerPropDef.vectorBaseType = schemaVectorBaseTypeToEnum(p.baseType)
    readerPropDef.len = p.size
  }
  if (p.type === 'cardinality') {
    readerPropDef.cardinalityMode = p.mode === 'dense' ? 1 : 0
    readerPropDef.cardinalityPrecision = p.precision ?? 8
  }
  if (p.type === 'text') {
    if (opts?.codes?.has(0)) {
      readerPropDef.locales = locales
    } else {
      if (
        opts?.codes?.size === 1 &&
        opts.codes.has(opts.localeFromDef as LangCode)
      ) {
        // dont add locales - interpets it as a normal prop
      } else if (opts?.codes) {
        readerPropDef.locales = {}
        for (const code of opts.codes) {
          readerPropDef.locales[code] = inverseLangMap.get(code)
        }
      }
    }
  }
  return readerPropDef
}

const normalizeHookFn = (fn: Function) => {
  let src = fn.toString()
  if (/^[a-zA-Z0-9_$]+\s*\(/.test(src)) {
    src = 'function ' + src
  }
  return src
}

export const convertToReaderSchema = (
  q: QueryDef,
  locales?: ReaderLocales,
): ReaderSchema => {
  if (!locales) {
    locales = {}
    console.warn('TODO: locales convertToReaderSchema')
    // for (const lang in q.schema.locales) {
    //   locales[langCodesMap.get(lang)] = lang
    // }
  }
  const t = q.type
  const isRoot = t === 4 // QueryDefType.Root (cant import type enum ofc)
  const isSingle =
    (isRoot && ('id' in q.target || 'alias' in q.target)) || q.selectFirstResult
  // @ts-ignore
  const isEdge = t === 1 // QueryDefType.Edge (cant import type enum ofc)
  const readerSchema: ReaderSchema = {
    readId: 0,
    props: {},
    search: false,
    main: { len: 0, props: {} },
    refs: {},
    type: isEdge
      ? ReaderSchemaEnum.edge
      : isSingle
        ? q.target.type === '_root'
          ? ReaderSchemaEnum.rootProps
          : ReaderSchemaEnum.single
        : ReaderSchemaEnum.default,
  }

  if (q.aggregate) {
    readerSchema.aggregate = {
      aggregates: [],
      totalResultsSize: q.aggregate.totalResultsSize,
    }
    const a = readerSchema.aggregate
    for (const aggArray of q.aggregate.aggregates.values()) {
      for (const agg of aggArray) {
        a.aggregates.push({
          path: agg.propDef.path,
          type: agg.type,
          resultPos: agg.resultPos,
        })
      }
    }
    if (q.aggregate.groupBy) {
      a.groupBy = {
        typeIndex: q.aggregate.groupBy.typeIndex,
      }
      if (q.aggregate.groupBy.stepRange) {
        a.groupBy.stepRange = q.aggregate.groupBy.stepRange
      }
      if (q.aggregate.groupBy.display) {
        a.groupBy.display = q.aggregate.groupBy.display
      }
      if ('enum' in q.aggregate.groupBy) {
        a.groupBy.enum = q.aggregate.groupBy.enum
      }
      if (q.aggregate.groupBy.stepType) {
        a.groupBy.stepType = true
      }
    }
  } else {
    if (q.schema?.propHooks?.read) {
      let body = ''
      for (const def of q.schema.propHooks.read) {
        const target = `r.${def.path.join('.')}`
        body += `if(r.${def.path.join('?.')}!=null)${target}=(${normalizeHookFn(def.hooks?.read as any)})(${target},r);`
      }

      if (q.schema?.hooks?.read) {
        body += `r=(${normalizeHookFn(q.schema.hooks.read)})(r);`
      }

      body += `return r;`
      readerSchema.hook = new Function('r', body) as typeof readerSchema.hook
    } else if (q.schema?.hooks?.read) {
      readerSchema.hook = q.schema.hooks.read
    }
    if (isRoot && q.search) {
      readerSchema.search = true
    }
    for (const [k, v] of q.include.props) {
      readerSchema.props[k] = createReaderPropDef(v.def, locales, v.opts)
    }
    readerSchema.main.len = q.include.main.len
    for (const [start, p, opts] of q.include.main.include.values()) {
      readerSchema.main.props[start] = createReaderPropDef(p, locales, opts)
    }
    for (const [k, v] of q.references.entries()) {
      const target = v.target as Target
      const propDef = target.propDef as QueryPropDef
      readerSchema.refs[k] = {
        schema: convertToReaderSchema(v, locales),
        prop: createReaderPropDef(propDef, locales),
      }
    }
    console.warn('TODO: handle edges here convertToReaderSchema')
    // if (q.edges) {
    //   readerSchema.edges = convertToReaderSchema(q.edges, locales)
    // }
  }
  return readerSchema
}
