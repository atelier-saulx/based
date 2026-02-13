import type { IntervalString } from '../../db-client/query/aggregates/types.js'
import { ReaderLocales, ReaderSchema } from '../../protocol/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'

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
}

export type Include = {
  // glob?: '*' | '**' // youri thinks we can just do these as props
  meta?: true | 'only' | false
  maxChars?: number
  maxBytes?: number
  raw?: boolean
}

export type QueryAst = {
  include?: Include
  select?: { start: number; end: number }
  locale?: string
  range?: { start: number; end: number }
  type?: string
  target?: number | number[] | Record<string, any>
  filter?: FilterAst
  sort?: { prop: string; order: 'asc' | 'desc' }
  props?: Record<string, QueryAst>
  edges?: QueryAst
  // aggregate options
  count?: { props?: string }
  sum?: { props: string[] }
  cardinality?: { props: string[] }
  avg?: { props: string[] }
  harmonicMean?: { props: string[] }
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
  }
}

export type Ctx = {
  query: AutoSizedUint8Array
  readSchema: ReaderSchema
  locales: ReaderLocales
}
