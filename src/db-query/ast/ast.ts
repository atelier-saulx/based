import { ReadLocales, ReadSchema } from '../../protocol/index.js'
import { LangName } from '../../schema/schema/locales.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { LangCodeEnum, FilterTypeEnum } from '../../zigTsExports.js'
import type { IntervalString } from './aggregates.js'

export type FilterOpts = {
  lowerCase?: boolean
  fn?:
    | 'dotProduct'
    | 'manhattanDistance'
    | 'cosineSimilarity'
    | 'euclideanDistance'
  score?: number
}

export type Operator =
  | '='
  | '<'
  | '>'
  | '!='
  | '>='
  | '<='
  | '..'
  | '!..'
  | 'exists'
  | '!exists'
  | 'like'
  | '!like'
  | 'includes'
  | '!includes'

export type FilterOp = {
  op: Operator
  val?: any
  opts?: FilterOpts
}

export type FilterLeaf = FilterAst & {
  ops?: FilterOp[]
  select?: { start: number; end: number }
}

export type FilterAst = {
  props?: {
    [key: string]: FilterLeaf
  }
  or?: FilterAst
  and?: FilterAst
  edges?: FilterAst
  filterType?: FilterTypeEnum
  // MIXED not supported yet
}

export type Include = {
  meta?: true | false | 'only'
  maxChars?: number
  maxBytes?: number
  raw?: boolean
  langCode?: LangCodeEnum
}

export type QueryAst = {
  include?: Include
  select?: { start: number; end: number }
  locale?: string
  localeFallBacks?: LangName[] | false
  range?: { start: number; end: number }
  type?: string
  target?: number | number[] | Record<string, any>
  filter?: FilterAst
  order?: 'asc' | 'desc'
  sort?: { prop: string }
  props?: Record<string, QueryAst>
  edges?: QueryAst
  // aggregate options
  count?: { props?: string }
  sum?: { props: string[] }
  cardinality?: { props: string[] }
  avg?: { props: string[] }
  hmean?: { props: string[] }
  max?: { props: string[] }
  min?: { props: string[] }
  stddev?: { props: string[]; samplingMode?: 'sample' | 'population' }
  variance?: { props: string[]; samplingMode?: 'sample' | 'population' }
  groupBy?: {
    prop: string
    step?: number | IntervalString
    timeZone?: string
    display?: Intl.DateTimeFormat
    enum?: string[]
  }[]
}

export type Ctx = {
  query: AutoSizedUint8Array
  readSchema: ReadSchema
  locales: ReadLocales
  locale: LangCodeEnum
  // localOverwrite for top level LOCALE (optional)
  LocaleFallBackOverwrite?: LangCodeEnum[]
  // Rest of fallbacks
  localeFallbacks: {
    [code: string]: LangCodeEnum[]
  }
  // Fix this
  filterHasEdge?: boolean
}

export type ReadOpts = {
  raw: boolean
  meta: true | false | 'only'
  code: LangCodeEnum
  langs?: ReadOpts[]
}

export type ReadCtx = Omit<Ctx, 'query' | 'readSchema'> &
  Partial<Pick<Ctx, 'query' | 'readSchema'>>
