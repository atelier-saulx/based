import type { FilterAst, QueryAst } from '../../db-query/ast/ast.js'
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
  ExpandDotPath,
  UnionToIntersection,
} from './types.js'
import type { ResolvedProps } from '../../schema/index.js'
import { astToQueryCtx } from '../../db-query/ast/toCtx.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import type { DbClient } from '../../sdk.js'
import { $buffer, proxyResult } from './result.js'
import type { StepInput, aggFnOptions } from '../query/aggregates/types.js'
import { readUint32 } from '../../utils/uint8.js'

class Query<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] = any,
  K extends
    | keyof ResolvedProps<S['types'], T>
    | '*'
    | '**'
    | { field: any; select: any }
    | string = '*', // Allow string for potential dot paths
  IsSingle extends boolean = false,
  SourceField extends string | number | symbol | undefined = undefined,
  IsRoot extends boolean = false,
  EdgeProps extends Record<string, any> = {},
  Aggregate = {},
  GroupedKey extends string | undefined = undefined,
> {
  constructor(ast: QueryAst) {
    this.ast = ast
  }
  ast: QueryAst

  locale<
    L extends string &
      (S['locales'] extends Record<string, any> ? keyof S['locales'] : string),
  >(
    locale: L,
  ): NextBranch<
    { types: S['types']; locales: L },
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate,
    GroupedKey
  > {
    this.ast.locale = locale
    return this as any
  }
  include<
    F extends [
      (
        | 'id'
        | (keyof (ResolvedProps<S['types'], T> & EdgeProps) & string)
        | Path<S, T>
        | '*'
        | '**'
        | ((q: SelectFn<S, T>) => AnyQuery<S>)
      ),
      ...(
        | 'id'
        | (keyof (ResolvedProps<S['types'], T> & EdgeProps) & string)
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
    (K extends '*' ? never : K) | ResolveIncludeArgs<F[number]>,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate,
    GroupedKey
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
    fn: (
      filter: FilterFn<S, T, EdgeProps>,
    ) => FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>,
  ): FilterBranch<this>
  filter<
    P extends keyof (ResolvedProps<S['types'], T> & EdgeProps) | Path<S, T>,
  >(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P, EdgeProps>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  filter(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    this.#filterGroup ??= this.ast.filter ??= {}
    return this.#addFilter(prop, op, val, opts, false)
  }

  and(
    fn: (
      filter: FilterFn<S, T, EdgeProps>,
    ) => FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>,
  ): FilterBranch<this>
  and<P extends keyof (ResolvedProps<S['types'], T> & EdgeProps) | Path<S, T>>(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P, EdgeProps>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  and(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    return this.filter(prop, op, val, opts)
  }

  or(
    fn: (
      filter: FilterFn<S, T, EdgeProps>,
    ) => FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>,
  ): FilterBranch<this>
  or<P extends keyof (ResolvedProps<S['types'], T> & EdgeProps) | Path<S, T>>(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P, EdgeProps>,
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
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  sum<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & UnionToIntersection<ExpandDotPath<P, { sum: number }>>,
    GroupedKey
  >
  sum(
    ...props: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { count: number },
    GroupedKey
  > {
    this.ast.count = {}
    return this as any
  }

  cardinality<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  cardinality<P extends string>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & UnionToIntersection<ExpandDotPath<P, { cardinality: number }>>,
    GroupedKey
  >
  cardinality(
    ...props: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
    if (typeof props[0] === 'function') {
      const fn = props[0]
      fn((prop: string) => new Query(traverse(this.ast, prop)))
      return this as any
    }
    if (props.length === 0) {
      throw new Error('Query: cardinality expects at least one argument')
    }
    parseAggregateProps(this.ast, 'cardinality', props as string[])
    return this as any
  }

  avg<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  avg<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & UnionToIntersection<ExpandDotPath<P, { avg: number }>>,
    GroupedKey
  >
  avg(
    ...props: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  hmean<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & UnionToIntersection<ExpandDotPath<P, { hmean: number }>>,
    GroupedKey
  >
  hmean(
    ...props: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  max<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate &
      UnionToIntersection<ExpandDotPath<P, { max: InferPathType<S, T, P> }>>,
    GroupedKey
  >
  max(
    ...props: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  min<P extends NumberPaths<S, T>>(
    ...props: [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate &
      UnionToIntersection<ExpandDotPath<P, { min: InferPathType<S, T, P> }>>,
    GroupedKey
  >
  min(
    ...props: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    opts?: aggFnOptions,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  stddev<P extends NumberPaths<S, T>>(
    ...args: [...P[], aggFnOptions] | [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & UnionToIntersection<ExpandDotPath<P, { stddev: number }>>,
    GroupedKey
  >
  stddev(
    ...args: any[]
  ): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    parseAggregateProps(this.ast, 'stddev', props as string[])
    return this as any
  }

  var<F extends (q: SelectFn<S, T>) => AnyQuery<S>>(
    fn: F,
    opts?: aggFnOptions,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & ResolveAggregate<F>,
    GroupedKey
  >
  var<P extends NumberPaths<S, T>>(
    ...args: [...P[], aggFnOptions] | [P, ...P[]]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & UnionToIntersection<ExpandDotPath<P, { variance: number }>>,
    GroupedKey
  >
  var(...args: any[]): NextBranch<any, any, any, any, any, any, any, any, any> {
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
    parseAggregateProps(this.ast, 'var', props as string[])
    return this as any
  }

  sort<P extends string>(
    prop: P,
    order?: 'asc' | 'desc',
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate,
    GroupedKey
  > {
    this.ast.order = order || 'asc'
    this.ast.sort = { prop }
    return this as any
  }

  order(
    order: 'asc' | 'desc',
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate,
    GroupedKey
  > {
    this.ast.order = order || 'asc'
    return this as any
  }

  range(
    start: number,
    end?: number,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate,
    GroupedKey
  > {
    const limit = end ? end - start : 1000
    this.ast.range = { start, end: limit }
    return this as any
  }

  groupBy<P extends string>(
    prop: P,
    step?: StepInput,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate,
    P
  > {
    this.ast.groupBy = { prop }
    if (step) {
      if (typeof step === 'object') {
        const s = step as any
        if (s.step) this.ast.groupBy.step = s.step
        if (s.timeZone) this.ast.groupBy.timeZone = s.timeZone
        if (s.display) this.ast.groupBy.display = s.display
      } else {
        this.ast.groupBy.step = step
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

type FilterMethods<T extends { filter: any }> = {
  and: T['filter']
  or: T['filter']
}

// This overload is for when the user provides NO schema argument, rely on generic default or explicit generic
export function query<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(type: T): Query<S, T, '*', false>

// This overload is for when the user provides NO schema argument + ID, rely on generic default or explicit generic
export function query<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  id: number | Partial<InferSchemaOutput<S, T>>,
): Query<S, T, '*', true>

export function query<
  S extends { types: any; locales?: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  target?: number | number[] | Partial<InferSchemaOutput<S, T>>,
): Query<S, T, '*', boolean> {
  const ast: any = { type }
  if (target) ast.target = target
  return new Query<S, T, '*', any>(ast)
}

export class BasedQuery2<
  S extends { types: any; locales?: any } = { types: any },
  T extends keyof S['types'] = any,
  K extends
    | keyof ResolvedProps<S['types'], T>
    | '*'
    | '**'
    | { field: any; select: any }
    | string = '*',
  IsSingle extends boolean = false,
  Aggregate = {},
  GroupedKey extends string | undefined = undefined,
> extends Query<S, T, K, IsSingle, undefined, true, {}, Aggregate, GroupedKey> {
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

  testGroupedKey(): GroupedKey {
    return null as any
  }
  testAggregate(): Aggregate {
    return null as any
  }
  testIsSingle(): IsSingle {
    return null as any
  }
  testK(): K {
    return null as any
  }

  db: DbClient
  async get(): Promise<
    [GroupedKey] extends [string]
      ? Record<string, Aggregate>
      : [keyof Aggregate] extends [never]
        ? IsSingle extends true
          ? PickOutput<
              S,
              T,
              ResolveInclude<ResolvedProps<S['types'], T>, K>
            > | null
          : PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>[]
        : Aggregate
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
  EdgeProps extends Record<string, any>,
> = FilterSignature<
  S,
  T,
  EdgeProps,
  FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>
>

type FilterSignature<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  EdgeProps extends Record<string, any>,
  Result,
> = {
  (
    fn: (
      filter: FilterFn<S, T, EdgeProps>,
    ) => FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>,
  ): Result
  <P extends keyof (ResolvedProps<S['types'], T> & EdgeProps) | Path<S, T>>(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P, EdgeProps>,
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
  '*',
  false,
  P,
  false,
  FilterEdges<ResolvedProps<S['types'], T>[P]> &
    (ResolvedProps<S['types'], T>[P] extends { items: infer Items }
      ? FilterEdges<Items>
      : {})
>

// ResolveIncludeArgs needs to stay here because it refers to Query
export type ResolveIncludeArgs<T> = T extends (
  q: any,
) => Query<
  infer S,
  infer T,
  infer K,
  infer Single,
  infer SourceField,
  any,
  any,
  infer Aggregate,
  infer GroupedKey
>
  ? [GroupedKey] extends [string]
    ? {
        field: SourceField
        select: { _aggregate: Record<string, Aggregate> }
      }
    : [keyof Aggregate] extends [never]
      ? { field: SourceField; select: K }
      : { field: SourceField; select: { _aggregate: Aggregate } }
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
type AnyQuery<S extends { types: any; locales?: any }> = Query<
  S,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

// Helper type to simplify method return types
type NextBranch<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K extends
    | keyof ResolvedProps<S['types'], T>
    | '*'
    | '**'
    | { field: any; select: any }
    | string,
  IsSingle extends boolean,
  SourceField extends string | number | symbol | undefined,
  IsRoot extends boolean,
  EdgeProps extends Record<string, any>,
  Aggregate,
  GroupedKey extends string | undefined,
> = IsRoot extends true
  ? BasedQuery2<S, T, K, IsSingle, Aggregate, GroupedKey>
  : Query<
      S,
      T,
      K,
      IsSingle,
      SourceField,
      IsRoot,
      EdgeProps,
      Aggregate,
      GroupedKey
    >

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
