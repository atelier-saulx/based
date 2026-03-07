import type { FilterAst, QueryAst } from '../ast/ast.js'
import type {
  PickOutput,
  ResolveInclude,
  Path,
  FilterOpts,
  Operator,
  ResolveDotPath,
  InferPathType,
  FilterEdges,
  InferSchemaOutput,
  NumberPaths,
  SortablePaths,
  ExpandDotPath,
  UnionToIntersection,
} from './types.js'
import type { ResolvedProps } from '../../schema/index.js'
import { astToQueryCtx } from '../ast/toCtx.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import type { DbClient } from '../../sdk.js'
import { $buffer, proxyResult } from './result.js'
import { readUint32 } from '../../utils/uint8.js'
import type { StepInput } from '../ast/aggregates.js'

type SetModeString = 'sample' | 'population'

type AggFnOptions = {
  mode?: SetModeString
}

// NEW OPTION TYPES
export type QueryOpts = {
  $K?: any
  $Single?: boolean
  $Field?: string | number | symbol
  $Root?: boolean
  $Edges?: any
  $Agg?: any
  $Group?: string
}

type OptK<O extends QueryOpts> = O extends { $K: infer V } ? V : '*'
type OptSingle<O extends QueryOpts> = O extends { $Single: infer V } ? V : false
type OptField<O extends QueryOpts> = O extends { $Field: infer V }
  ? V
  : undefined
type OptRoot<O extends QueryOpts> = O extends { $Root: infer V } ? V : false
type OptEdges<O extends QueryOpts> = O extends { $Edges: infer V } ? V : {}
type OptAgg<O extends QueryOpts> = O extends { $Agg: infer V } ? V : {}
type OptGroup<O extends QueryOpts> = O extends { $Group: infer V }
  ? V
  : undefined

type MergeOpts<O extends QueryOpts, Updates extends QueryOpts> = {
  $K: '$K' extends keyof Updates ? Updates['$K'] : OptK<O>
  $Single: '$Single' extends keyof Updates ? Updates['$Single'] : OptSingle<O>
  $Field: '$Field' extends keyof Updates ? Updates['$Field'] : OptField<O>
  $Root: '$Root' extends keyof Updates ? Updates['$Root'] : OptRoot<O>
  $Edges: '$Edges' extends keyof Updates ? Updates['$Edges'] : OptEdges<O>
  $Agg: '$Agg' extends keyof Updates ? Updates['$Agg'] : OptAgg<O>
  $Group: '$Group' extends keyof Updates ? Updates['$Group'] : OptGroup<O>
}

class Query<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] = any,
  Opts extends QueryOpts = {},
> {
  constructor(ast: QueryAst) {
    this.ast = ast
  }
  ast: QueryAst

  locale<
    L extends string &
      (S['locales'] extends Record<string, any> ? keyof S['locales'] : string),
  >(locale: L): NextBranch<{ types: S['types']; locales: L }, T, Opts> {
    this.ast.locale = locale
    return this as any
  }

  include<
    F extends [
      (
        | 'id'
        | (keyof (ResolvedProps<S['types'], T> & OptEdges<Opts>) & string)
        | Path<S, T>
        | '*'
        | '**'
        | ((q: SelectFn<S, T>) => AnyQuery<S>)
      ),
      ...(
        | 'id'
        | (keyof (ResolvedProps<S['types'], T> & OptEdges<Opts>) & string)
        | Path<S, T>
        | '*'
        | '**'
        | ((q: SelectFn<S, T>) => AnyQuery<S>)
      )[],
    ],
  >(
    ...props: F
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $K:
          | (OptK<Opts> extends '*' ? never : OptK<Opts>)
          | ResolveIncludeArgs<F[number]>
      }
    >
  > {
    if (props.length === 0) {
      throw new Error('Query: include expects at least one argument')
    }
    for (const prop of props as (string | Function)[]) {
      if (typeof prop === 'function') {
        prop((prop: string) => new Query(traverse(this.ast, prop)))
      } else {
        traverse(this.ast, prop).include = {}
      }
    }
    return this as any
  }

  filter(
    fn: (filter: FilterFn<S, T, Opts>) => FilterBranch<Query<S, T, Opts>>,
  ): FilterBranch<this>
  filter<P extends FilterProp<S, T, Opts>, O extends Operator = Operator>(
    prop: P,
    op: O,
    val: FilterValue<O, S, T, P, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  filter(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    this.#filterGroup ??= this.ast.filter ??= {}
    return this.#addFilter(prop, op, val, opts, false)
  }

  and(
    fn: (filter: FilterFn<S, T, Opts>) => FilterBranch<Query<S, T, Opts>>,
  ): FilterBranch<this>
  and<P extends FilterProp<S, T, Opts>, O extends Operator = Operator>(
    prop: P,
    op: O,
    val: FilterValue<O, S, T, P, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  and(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    return this.filter(prop, op, val, opts)
  }

  or(
    fn: (filter: FilterFn<S, T, Opts>) => FilterBranch<Query<S, T, Opts>>,
  ): FilterBranch<this>
  or<P extends FilterProp<S, T, Opts>, O extends Operator = Operator>(
    prop: P,
    op: O,
    val: FilterValue<O, S, T, P, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  or(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    this.#filterGroup ??= this.ast.filter ??= {}
    this.#filterGroup = this.#filterGroup.or ??= {}
    return this.#addFilter(prop, op, val, opts, true)
  }

  sum<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  sum<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { sum: number }>>
      }
    >
  >
  sum(...props: any[]): NextBranch<any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: sum expects at least one argument')
    }
    parseAggregateProps(this.ast, 'sum', props as string[])
    return this as any
  }

  count(): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & { count: number } }>
  > {
    this.ast.count = {}
    return this as any
  }

  cardinality<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  cardinality<P extends string>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { cardinality: number }>>
      }
    >
  >
  cardinality(...props: any[]): NextBranch<any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: cardinality expects at least one argument')
    }
    parseAggregateProps(this.ast, 'cardinality', props)
    return this as any
  }

  avg<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  avg<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { avg: number }>>
      }
    >
  >
  avg(...props: any[]): NextBranch<any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: avg expects at least one argument')
    }
    parseAggregateProps(this.ast, 'avg', props as string[])
    return this as any
  }

  hmean<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  hmean<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { hmean: number }>>
      }
    >
  >
  hmean(...props: any[]): NextBranch<any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: hmean expects at least one argument')
    }
    parseAggregateProps(this.ast, 'hmean', props as string[])
    return this as any
  }

  max<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  max<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { max: InferPathType<S, T, P> }>>
      }
    >
  >
  max(...props: any[]): NextBranch<any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: max expects at least one argument')
    }
    parseAggregateProps(this.ast, 'max', props as string[])
    return this as any
  }

  min<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  min<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { min: InferPathType<S, T, P> }>>
      }
    >
  >
  min(...props: any[]): NextBranch<any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: min expects at least one argument')
    }
    parseAggregateProps(this.ast, 'min', props as string[])
    return this as any
  }

  stddev<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
    opts?: AggFnOptions,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  stddev<P extends NumberPaths<S, T>>(
    ...args: [...P[], AggFnOptions] | [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { stddev: number }>>
      }
    >
  >
  stddev(...args: any[]): NextBranch<any, any, any> {
    if (typeof args[0] === 'function') {
      const fn = args[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (args.length === 0) {
      throw new Error('Query: stddev expects at least one argument')
    }
    let opts: any
    let props: string[]
    if (
      typeof args[args.length - 1] === 'object' &&
      !Array.isArray(args[args.length - 1])
    ) {
      opts = args[args.length - 1]
      props = args.slice(0, -1)
    } else if (Array.isArray(args[0])) {
      props = args[0]
      opts = args[1]
    } else {
      props = args
    }
    parseAggregateProps(this.ast, 'stddev', props, opts)
    return this as any
  }

  var<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
    opts?: AggFnOptions,
  ): NextBranch<
    S,
    T,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<F> }>
  >
  var<P extends NumberPaths<S, T>>(
    ...args: [...P[], AggFnOptions] | [P, ...P[]]
  ): NextBranch<
    S,
    T,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<P, { variance: number }>>
      }
    >
  >
  var(...args: any[]): NextBranch<any, any, any> {
    if (typeof args[0] === 'function') {
      const fn = args[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (args.length === 0) {
      throw new Error('Query: var expects at least one argument')
    }
    let opts: any
    let props: string[]
    if (
      typeof args[args.length - 1] === 'object' &&
      !Array.isArray(args[args.length - 1])
    ) {
      opts = args[args.length - 1]
      props = args.slice(0, -1)
    } else if (Array.isArray(args[0])) {
      props = args[0]
      opts = args[1]
    } else {
      props = args
    }
    parseAggregateProps(this.ast, 'variance', props, opts)
    return this as any
  }

  sort<P extends SortablePaths<S, T, OptEdges<Opts>>>(prop: P): this {
    this.ast.sort = { prop: prop as string }
    return this as any
  }

  order(order: 'asc' | 'desc'): this {
    this.ast.order = order || 'asc'
    return this as any
  }

  range(start: number, end?: number): this {
    const limit = end ? end - start : 1000
    this.ast.range = { start, end: limit }
    return this as any
  }

  groupBy<P extends string>(
    prop: P,
    step?: StepInput,
  ): NextBranch<S, T, MergeOpts<Opts, { $Group: P }>> {
    const parts = prop.split('.')
    let target = this.ast
    let field: string = prop
    if (parts.length > 1) {
      field = parts.pop()!
      target = traverse(this.ast, parts.join('.'))
    }
    target.groupBy = { prop: field as any }
    if (step) {
      if (typeof step === 'object') {
        const s = step as any
        if (s.step) target.groupBy.step = s.step
        if (s.timeZone) target.groupBy.timeZone = s.timeZone
        if (s.display) target.groupBy.display = s.display
      } else {
        target.groupBy.step = step
      }
    }
    return this as any
  }

  #filterGroup?: FilterAst
  #addFilter(
    prop: any,
    op: any,
    val: any,
    opts: any,
    isOr: boolean,
  ): FilterBranch<this> {
    if (typeof prop === 'function') {
      prop((...args) => {
        const target = isOr
          ? this.#filterGroup!
          : (this.#filterGroup!.and ??= {})
        const branch = new Query(target)
        branch.#filterGroup = target
        ;(branch.filter as any)(...args)
        return branch
      })
      return this as any
    }

    const target = traverse(this.#filterGroup, prop as string)
    target.ops ??= []
    target.ops.push({ op, val })
    return this as any
  }
}

type FilterBranch<T extends { filter: any }> = T

// This overload is for when the user provides NO schema argument, rely on generic default or explicit generic
export function query<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(type: T): Query<S, T, { $Root: false; $Single: false }>

// This overload is for when the user provides NO schema argument + ID, rely on generic default or explicit generic
export function query<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  id: number | Partial<InferSchemaOutput<S, T>>,
): Query<S, T, { $Root: false; $Single: true }>

export function query<
  S extends { types: any; locales?: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  target?: number | number[] | Partial<InferSchemaOutput<S, T>>,
): Query<S, T, { $Root: false; $Single: boolean }> {
  const ast: any = { type }
  if (target) ast.target = target
  return new Query(ast)
}

export class BasedQuery2<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] = any,
  Opts extends QueryOpts = {},
> extends Query<S, T, MergeOpts<Opts, { $Root: true }>> {
  constructor(
    db: DbClient,
    type: T,
    target?: number | number[] | Partial<InferSchemaOutput<S, T>>,
  ) {
    super({})
    this.ast.type = type as string
    if (target) this.ast.target = target
    this.db = db
  }

  db: DbClient
  async get(): Promise<
    [OptGroup<Opts>] extends [string]
      ? Record<string, OptAgg<Opts>>
      : [keyof OptAgg<Opts>] extends [never]
        ? OptSingle<Opts> extends true
          ? PickOutput<
              S,
              T,
              ResolveInclude<ResolvedProps<S['types'], T>, OptK<Opts>>
            > | null
          : PickOutput<
              S,
              T,
              ResolveInclude<ResolvedProps<S['types'], T>, OptK<Opts>>
            >[]
        : OptAgg<Opts>
  > {
    if (
      !this.ast.props &&
      !this.ast.sum &&
      !this.ast.count &&
      !this.ast.avg &&
      !this.ast.hmean &&
      !this.ast.max &&
      !this.ast.min &&
      !this.ast.stddev &&
      !this.ast.variance &&
      !this.ast.cardinality
    ) {
      this.include('*')
    }
    if (!this.db.schema) {
      await this.db.once('schema')
    }
    await this.db.isModified()
    const ctx = astToQueryCtx(
      this.db.schema!,
      this.ast,
      new AutoSizedUint8Array(),
    )
    const result = await this.db.hooks.getQueryBuf(ctx.query)

    return proxyResult(result, ctx.readSchema) as any
  }
}

type FilterFn<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  Opts extends QueryOpts,
> = FilterSignature<S, T, Opts, FilterBranch<Query<S, T, Opts>>>

type FilterProp<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  Opts extends QueryOpts,
> = keyof (ResolvedProps<S['types'], T> & OptEdges<Opts>) | Path<S, T> | 'id'

type FilterValue<
  O extends Operator,
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  P,
  Opts extends QueryOpts = {},
> = O extends '=' | '!='
  ?
      | InferPathType<S, T, P, OptEdges<Opts>>
      | InferPathType<S, T, P, OptEdges<Opts>>[]
  : InferPathType<S, T, P, OptEdges<Opts>>

type FilterSignature<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  Opts extends QueryOpts,
  Result,
> = {
  (
    fn: (filter: FilterFn<S, T, Opts>) => FilterBranch<Query<S, T, Opts>>,
  ): Result
  <P extends FilterProp<S, T, Opts>, O extends Operator = Operator>(
    prop: P,
    op: O,
    val: FilterValue<O, S, T, P, Opts>,
    opts?: FilterOpts,
  ): Result
}

type SelectFn<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = <P extends keyof ResolvedProps<S['types'], T>>(
  field: P,
) => Query<
  S,
  ResolvedProps<S['types'], T>[P] extends { ref: infer R extends string }
    ? R
    : ResolvedProps<S['types'], T>[P] extends {
          items: { ref: infer R extends string }
        }
      ? R
      : never,
  {
    $K: '*'
    $Single: false
    $Field: P
    $Root: false
    $Edges: FilterEdges<ResolvedProps<S['types'], T>[P]> &
      (ResolvedProps<S['types'], T>[P] extends { items: infer Items }
        ? FilterEdges<Items>
        : {})
  }
>

// ResolveIncludeArgs needs to stay here because it refers to Query
type ResolveIncludeArgs<T> = T extends (
  q: any,
) => Query<any, any, infer Opts extends QueryOpts>
  ? [OptGroup<Opts>] extends [string]
    ? {
        field: OptField<Opts>
        select: { _aggregate: Record<string, OptAgg<Opts>> }
      }
    : [keyof OptAgg<Opts>] extends [never]
      ? { field: OptField<Opts>; select: OptK<Opts> }
      : { field: OptField<Opts>; select: { _aggregate: OptAgg<Opts> } }
  : T extends string
    ? ResolveDotPath<T>
    : T

// ResolveAggregate extracts the aggregate structure from a callback function
type ResolveAggregate<T> =
  ResolveIncludeArgs<T> extends {
    field: infer F extends string | number | symbol
    select: { _aggregate: infer A }
  }
    ? { [K in F]: A }
    : never

// Helper type to simplify include signature
type AnyQuery<S extends { types: any; locales?: any }> = Query<S, any, any>

// Helper type to simplify method return types
type NextBranch<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  Opts extends QueryOpts,
> = OptRoot<Opts> extends true ? BasedQuery2<S, T, Opts> : Query<S, T, Opts>

function traverse(target: any, prop: string) {
  const path = prop.split('.')
  for (const key of path) {
    if (key[0] === '$') {
      target.edges ??= {}
      target.edges.props ??= {}
      target = target.edges.props[key] ??= {}
    } else {
      target.props ??= {}
      target = target.props[key] ??= {}
    }
  }
  return target
}

function parseAggregateProps(
  ast: any,
  aggName: string,
  props: string[],
  opts?: any,
) {
  for (const prop of props) {
    const parts = prop.split('.')
    let target = ast
    let field = prop
    if (parts.length > 1) {
      field = parts.pop()!
      target = traverse(ast, parts.join('.'))
    }
    target[aggName] ??= { props: [] }
    if (opts?.mode) {
      target[aggName].samplingMode = opts.mode
    }
    target[aggName].props.push(field)
  }
}

export const checksum = (res: any): number => {
  const buf = res?.[$buffer]
  return buf ? readUint32(buf, buf.byteLength - 4) : 0
}
