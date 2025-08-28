// import type { IncludeOpts, QueryDef, Target } from '@based/db'
import { inverseLangMap, langCodesMap } from '@based/schema'
import {
  PropDef,
  PropDefEdge,
  COLVEC,
  ENUM,
  TEXT,
  VECTOR,
} from '@based/schema/def'
import {
  ReaderLocales,
  ReaderMeta,
  ReaderPropDef,
  ReaderSchema,
  ReaderSchemaEnum,
} from '@based/protocol/db-read'
import { IncludeOpts, QueryDef, Target } from './types.js'

const createReaderPropDef = (
  p: PropDef | PropDefEdge,
  locales: ReaderLocales,
  opts?: IncludeOpts,
): ReaderPropDef => {
  const readerPropDef: ReaderPropDef = {
    path: p.__isEdge ? p.path.slice(1) : p.path,
    typeIndex: p.typeIndex,
    readBy: 0,
  }
  if (opts?.meta) {
    readerPropDef.meta =
      opts?.meta === 'only' ? ReaderMeta.only : ReaderMeta.combined
  }
  if (p.typeIndex === ENUM) {
    readerPropDef.enum = p.enum
  }
  if (p.typeIndex === VECTOR || p.typeIndex === COLVEC) {
    readerPropDef.vectorBaseType = p.vectorBaseType
    readerPropDef.len = p.len
  }
  if (p.typeIndex === TEXT) {
    if (opts.codes.has(0)) {
      readerPropDef.locales = locales
    } else {
      if (opts.codes.size === 1 && opts.codes.has(opts.localeFromDef)) {
        // dont add locales - interpets it as a normal prop
      } else {
        readerPropDef.locales = {}
        for (const code of opts.codes) {
          readerPropDef.locales[code] = inverseLangMap.get(code)
        }
      }
    }
  }
  return readerPropDef
}

export const convertToReaderSchema = (
  q: QueryDef,
  locales?: ReaderLocales,
): ReaderSchema => {
  if (!locales) {
    locales = {}
    for (const lang in q.schema.locales) {
      locales[langCodesMap.get(lang)] = lang
    }
  }
  const t = q.type
  const isRoot = t === 4 // QueryDefType.Root (cant import type enum ofc)
  const isSingle = isRoot && ('id' in q.target || 'alias' in q.target)
  const isEdge = t === 1 // QueryDefType.Edge (cant import type enum ofc)
  const readerSchema: ReaderSchema = {
    readId: 0,
    props: {},
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
      if (q.aggregate.groupBy.enum) {
        a.groupBy.enum = q.aggregate.groupBy.enum
      }
      if (q.aggregate.groupBy.stepType) {
        a.groupBy.stepType = true
      }
    }
  } else {
    if (q.schema?.hooks?.read) {
      readerSchema.hook = q.schema.hooks.read
    }
    if (isRoot && q.search) {
      readerSchema.search = true
    }
    for (const [k, v] of q.include.props) {
      readerSchema.props[k] = createReaderPropDef(v.def, locales, v.opts)
    }
    readerSchema.main.len = q.include.main.len
    for (const k in q.include.main.include) {
      const [start, p, opts] = q.include.main.include[k]
      readerSchema.main.props[start] = createReaderPropDef(p, locales, opts)
    }
    for (const [k, v] of q.references.entries()) {
      const target = v.target as Target
      const propDef = target.propDef
      readerSchema.refs[k] = {
        schema: convertToReaderSchema(v, locales),
        prop: createReaderPropDef(propDef, locales),
      }
    }
    if (q.edges) {
      readerSchema.edges = convertToReaderSchema(q.edges, locales)
    }
  }
  return readerSchema
}
