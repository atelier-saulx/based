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

export type FilterAst = {
  props?: {
    [key: string]: FilterAst & {
      ops?: FilterOp[]
      select?: { start: number; end: number }
    }
  }
  or?: FilterAst
  and?: FilterAst
  edges?: FilterAst
}

export type Include = {
  glob?: '*' | '**'
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
  target?: string | number | (number | string)[]
  filter?: FilterAst
  sort?: { prop: string; order: 'asc' | 'desc' }
  props?: Record<string, QueryAst>
  edges?: QueryAst
  // ----------- Aggregate stuff
  count?: { props: string | void }
  sum?: { props: string | string[] }
  cardinality?: { props: string | string[] }
  avg?: { props: string | string[] }
  harmonicMean?: { props: string | string[] }
  max?: { props: string | string[] }
  min?: { props: string | string[] }
  stddev?: { props: string | string[]; samplingMode: 'sample' | 'population' }
  var?: { props: string | string[]; samplingMode: 'sample' | 'population' }
  groupBy?: {
    prop: string
    step?: number | IntervalString
    timeZone?: string
    display?: Intl.DateTimeFormat
  }
}

export type Ctx = {
  query: AutoSizedUint8Array
  readSchema: ReaderSchema
  locales: ReaderLocales
}
