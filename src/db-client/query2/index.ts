import type { FilterAst, FilterLeaf, QueryAst } from '../../db-query/ast/ast.js'
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
} from './types.js'
import type { ResolvedProps, SchemaOut } from '../../schema/index.js'
import { astToQueryCtx } from '../../db-query/ast/toCtx.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import type { DbClient } from '../../sdk.js'
import { proxyResult } from './result.js'
import type {
  StepInput,
  IntervalString,
  aggFnOptions,
} from '../query/aggregates/types.js'

class Query<
  S extends { types: any } = { types: any },
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
  include<
    F extends (
      | (keyof (ResolvedProps<S['types'], T> & EdgeProps) & string)
      | Path<S['types'], T>
      | '*'
      | '**'
      | ((q: SelectFn<S, T>) => Query<S, any, any, any, any>)
    )[],
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
    P extends
      | keyof (ResolvedProps<S['types'], T> & EdgeProps)
      | Path<S['types'], T>,
  >(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P>,
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
  and<
    P extends
      | keyof (ResolvedProps<S['types'], T> & EdgeProps)
      | Path<S['types'], T>,
  >(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P>,
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
  or<
    P extends
      | keyof (ResolvedProps<S['types'], T> & EdgeProps)
      | Path<S['types'], T>,
  >(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  or(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    this.#filterGroup ??= this.ast.filter ??= {}
    this.#filterGroup = this.#filterGroup.or ??= {}
    return this.#addFilter(prop, op, val, opts, true)
  }

  sum<P extends NumberPaths<S, T>>(
    ...props: P[]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { [Key in P]: { sum: number } },
    GroupedKey
  > {
    this.ast.sum ??= { props: [] }
    this.ast.sum.props.push(...(props as string[]))
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

  cardinality<P extends string>(
    ...props: P[]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { [Key in P]: { cardinality: number } },
    GroupedKey
  > {
    this.ast.cardinality ??= { props: [] }
    this.ast.cardinality.props.push(...props)
    return this as any
  }

  avg<P extends NumberPaths<S, T>>(
    ...props: P[]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { [Key in P]: { avg: number } },
    GroupedKey
  > {
    this.ast.avg ??= { props: [] }
    this.ast.avg.props.push(...(props as string[]))
    return this as any
  }

  hmean<P extends NumberPaths<S, T>>(
    ...props: P[]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { [Key in P]: { hmean: number } },
    GroupedKey
  > {
    this.ast.hmean ??= { props: [] }
    this.ast.hmean.props.push(...(props as string[]))
    return this as any
  }

  max<P extends NumberPaths<S, T>>(
    ...props: P[]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { [Key in P]: { max: InferPathType<S, T, Key> } },
    GroupedKey
  > {
    this.ast.max ??= { props: [] }
    this.ast.max.props.push(...(props as string[]))
    return this as any
  }

  min<P extends NumberPaths<S, T>>(
    ...props: P[]
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & { [Key in P]: { min: InferPathType<S, T, Key> } },
    GroupedKey
  > {
    this.ast.min ??= { props: [] }
    this.ast.min.props.push(...(props as string[]))
    return this as any
  }

  stddev<P extends NumberPaths<S, T>>(
    prop: P | P[],
    opts?: aggFnOptions,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & {
      [Key in P extends any[] ? P[number] : P]: { stddev: number }
    },
    GroupedKey
  > {
    this.ast.stddev ??= { props: [] }
    const props = Array.isArray(prop) ? prop : [prop]
    this.ast.stddev.props.push(...(props as string[]))
    if (opts?.mode) {
      this.ast.stddev.samplingMode = opts.mode
    }
    return this as any
  }

  var<P extends NumberPaths<S, T>>(
    prop: P | P[],
    opts?: aggFnOptions,
  ): NextBranch<
    S,
    T,
    K,
    IsSingle,
    SourceField,
    IsRoot,
    EdgeProps,
    Aggregate & {
      [Key in P extends any[] ? P[number] : P]: { variance: number }
    },
    GroupedKey
  > {
    this.ast.variance ??= { props: [] }
    const props = Array.isArray(prop) ? prop : [prop]
    this.ast.variance.props.push(...(props as string[]))
    if (opts?.mode) {
      this.ast.variance.samplingMode = opts.mode
    }
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
    this.ast.sort = { prop, order: order || 'asc' }
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
    if (this.ast.sort) {
      this.ast.sort.order = order
    } else {
      this.ast.sort = { prop: 'id', order }
    }
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

type FilterBranch<T extends { filter: any }> = Omit<T, 'and' | 'or'> &
  FilterMethods<T>

type FilterMethods<T extends { filter: any }> = {
  and: T['filter']
  or: T['filter']
}

// This overload is for when the user provides NO schema argument, rely on generic default or explicit generic
export function query<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(type: T): Query<S, T, '*', false>

// This overload is for when the user provides NO schema argument + ID, rely on generic default or explicit generic
export function query<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  id: number | Partial<InferSchemaOutput<S, T>>,
): Query<S, T, '*', true>

export function query<
  S extends { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  id?: number | Partial<InferSchemaOutput<S, T>>,
): Query<S, T, '*', boolean> {
  const ast: any = { type }
  if (id) ast.target = id
  return new Query<S, T, '*', any>(ast)
}

export class BasedQuery2<
  S extends { types: any } = { types: any },
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
    target?: number | Partial<InferSchemaOutput<S, T>>,
  ) {
    super({})
    this.ast.type = type as string
    if (target) this.ast.target = target
    this.db = db
  }
  db: DbClient
  async get(): Promise<
    [keyof Aggregate] extends [never]
      ? IsSingle extends true
        ? PickOutput<
            S,
            T,
            ResolveInclude<ResolvedProps<S['types'], T>, K>
          > | null
        : PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>[]
      : GroupedKey extends string
        ? Record<string, Aggregate>
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
  S extends { types: any },
  T extends keyof S['types'],
  EdgeProps extends Record<string, any>,
> = FilterSignature<
  S,
  T,
  EdgeProps,
  FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>
>

type FilterSignature<
  S extends { types: any },
  T extends keyof S['types'],
  EdgeProps extends Record<string, any>,
  Result,
> = {
  (
    fn: (
      filter: FilterFn<S, T, EdgeProps>,
    ) => FilterBranch<Query<S, T, any, any, any, any, EdgeProps>>,
  ): Result
  <
    P extends
      | keyof (ResolvedProps<S['types'], T> & EdgeProps)
      | Path<S['types'], T>,
  >(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P>,
    opts?: FilterOpts,
  ): Result
}

type SelectFn<S extends { types: any }, T extends keyof S['types']> = <
  P extends keyof ResolvedProps<S['types'], T>,
>(
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
  any,
  any
>
  ? { field: SourceField; select: K }
  : T extends string
    ? ResolveDotPath<T>
    : T

// Helper type to simplify method return types
type NextBranch<
  S extends { types: any },
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
