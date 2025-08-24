import {
  ENUM,
  PropDef,
  PropDefEdge,
  TEXT,
  TypeIndex,
  VECTOR,
} from '@based/schema/def'
import { IncludeOpts, QueryDef, QueryDefType, Target } from '../types.js'
import { inverseLangMap, langCodesMap } from '@based/schema'

export type Item = {
  id: number
} & { [key: string]: any }

export type Meta = {
  checksum: number
  size: number
  crc32: number
  compressed: boolean
  value?: any
}

export type AggItem = Partial<Item>

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

export enum ReaderSchemaEnum {
  edge = 1,
  default = 2,
  single = 3,
  rootProps = 4,
}

export enum ReaderMeta {
  only = 1,
  combined = 2,
}

export type ReadInstruction = (
  q: ReaderSchema,
  result: Uint8Array,
  i: number,
  item: Item,
) => number

export type ReaderLocales = { [langCode: string]: string }

export type ReaderPropDef = {
  path: string[]
  typeIndex: TypeIndex
  meta?: ReaderMeta
  enum?: any[]
  vectorBaseType?: PropDef['vectorBaseType']
  readBy: number
  locales?: { [langCode: string]: string }
}

export type ReaderAggregateSchema = {
  aggregates: {
    path: string[]
    type: number
    resultPos: number
  }[]
  groupBy?: {
    typeIndex: number
    stepRange?: number
    stepType?: boolean
    display?: Intl.DateTimeFormat // find a way for this -- shitty
    enum?: any[]
  }
  totalResultsSize: number
}

// Move these types to seperate pkg including query def agg
export type ReaderSchema = {
  readId: number
  // maybe current read id that you add
  props: { [prop: string]: ReaderPropDef }
  main: { props: { [start: string]: ReaderPropDef }; len: number }
  type: ReaderSchemaEnum
  refs: {
    [prop: string]: {
      schema: ReaderSchema
      prop: ReaderPropDef
    }
  }
  aggregate?: ReaderAggregateSchema
  edges?: ReaderSchema
  search?: boolean
}

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
  if (p.typeIndex === VECTOR) {
    readerPropDef.vectorBaseType = p.vectorBaseType
  }
  if (p.typeIndex === TEXT) {
    if (opts.codes.has(0)) {
      readerPropDef.locales = locales
    } else {
      if (opts.codes.size === 1) {
        // this just means the value is this
        // readerPropDef.locale =
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
  const isRoot = t === QueryDefType.Root
  const isSingle = isRoot && ('id' in q.target || 'alias' in q.target)
  const isEdge = t === QueryDefType.Edge
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
        prop: {
          path: propDef.path,
          typeIndex: propDef.typeIndex,
          readBy: 0,
        },
      }
    }
    if (q.edges) {
      readerSchema.edges = convertToReaderSchema(q.edges, locales)
    }
  }
  return readerSchema
}
