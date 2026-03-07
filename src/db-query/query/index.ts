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

type OptK<BaseOpts extends QueryOpts> = BaseOpts extends { $K: infer Value } ? Value : '*'
type OptSingle<BaseOpts extends QueryOpts> = BaseOpts extends { $Single: infer Value } ? Value : false
type OptField<BaseOpts extends QueryOpts> = BaseOpts extends { $Field: infer Value }
  ? Value
  : undefined
type OptRoot<BaseOpts extends QueryOpts> = BaseOpts extends { $Root: infer Value } ? Value : false
type OptEdges<BaseOpts extends QueryOpts> = BaseOpts extends { $Edges: infer Value } ? Value : {}
type OptAgg<BaseOpts extends QueryOpts> = BaseOpts extends { $Agg: infer Value } ? Value : {}
type OptGroup<BaseOpts extends QueryOpts> = BaseOpts extends { $Group: infer Value }
  ? Value
  : undefined

type MergeOpts<BaseOpts extends QueryOpts, Updates extends QueryOpts> = {
  $K: '$K' extends keyof Updates ? Updates['$K'] : OptK<BaseOpts>
  $Single: '$Single' extends keyof Updates ? Updates['$Single'] : OptSingle<BaseOpts>
  $Field: '$Field' extends keyof Updates ? Updates['$Field'] : OptField<BaseOpts>
  $Root: '$Root' extends keyof Updates ? Updates['$Root'] : OptRoot<BaseOpts>
  $Edges: '$Edges' extends keyof Updates ? Updates['$Edges'] : OptEdges<BaseOpts>
  $Agg: '$Agg' extends keyof Updates ? Updates['$Agg'] : OptAgg<BaseOpts>
  $Group: '$Group' extends keyof Updates ? Updates['$Group'] : OptGroup<BaseOpts>
}

class Query<
  Schema extends { types: any; locales?: any } = { types: any },
  Type extends keyof Schema['types'] = any,
  Opts extends QueryOpts = {},
> {
  constructor(ast: QueryAst) {
    this.ast = ast
  }
  ast: QueryAst

  locale<
    Locale extends string &
      (Schema['locales'] extends Record<string, any> ? keyof Schema['locales'] : string),
  >(locale: Locale): NextBranch<{ types: Schema['types']; locales: Locale }, Type, Opts> {
    this.ast.locale = locale
    return this as any
  }

  include<
    QueryArg extends [
      (
        | 'id'
        | (keyof (ResolvedProps<Schema['types'], Type> & OptEdges<Opts>) & string)
        | Path<Schema, Type>
        | '*'
        | '**'
        | ((q: SelectFn<Schema, Type>) => AnyQuery<Schema>)
      ),
      ...(
        | 'id'
        | (keyof (ResolvedProps<Schema['types'], Type> & OptEdges<Opts>) & string)
        | Path<Schema, Type>
        | '*'
        | '**'
        | ((q: SelectFn<Schema, Type>) => AnyQuery<Schema>)
      )[],
    ],
  >(
    ...props: QueryArg
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $K:
          | (OptK<Opts> extends '*' ? never : OptK<Opts>)
          | ResolveIncludeArgs<QueryArg[number]>
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
    fn: (filter: FilterFn<Schema, Type, Opts>) => FilterBranch<Query<Schema, Type, Opts>>,
  ): FilterBranch<this>
  filter<Prop extends FilterProp<Schema, Type, Opts>, Op extends Operator = Operator>(
    prop: Prop,
    op: Op,
    val: FilterValue<Op, Schema, Type, Prop, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  filter(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    this.#filterGroup ??= this.ast.filter ??= {}
    return this.#addFilter(prop, op, val, opts, false)
  }

  and(
    fn: (filter: FilterFn<Schema, Type, Opts>) => FilterBranch<Query<Schema, Type, Opts>>,
  ): FilterBranch<this>
  and<Prop extends FilterProp<Schema, Type, Opts>, Op extends Operator = Operator>(
    prop: Prop,
    op: Op,
    val: FilterValue<Op, Schema, Type, Prop, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  and(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    return this.filter(prop, op, val, opts)
  }

  or(
    fn: (filter: FilterFn<Schema, Type, Opts>) => FilterBranch<Query<Schema, Type, Opts>>,
  ): FilterBranch<this>
  or<Prop extends FilterProp<Schema, Type, Opts>, Op extends Operator = Operator>(
    prop: Prop,
    op: Op,
    val: FilterValue<Op, Schema, Type, Prop, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  or(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    this.#filterGroup ??= this.ast.filter ??= {}
    this.#filterGroup = this.#filterGroup.or ??= {}
    return this.#addFilter(prop, op, val, opts, true)
  }

  sum<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  sum<Prop extends NumberPaths<Schema, Type>>(
    ...props: [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { sum: number }>>
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
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & { count: number } }>
  > {
    this.ast.count = {}
    return this as any
  }

  cardinality<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  cardinality<Prop extends string>(
    ...props: [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { cardinality: number }>>
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

  avg<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  avg<Prop extends NumberPaths<Schema, Type>>(
    ...props: [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { avg: number }>>
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

  hmean<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  hmean<Prop extends NumberPaths<Schema, Type>>(
    ...props: [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { hmean: number }>>
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

  max<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  max<Prop extends NumberPaths<Schema, Type>>(
    ...props: [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { max: InferPathType<Schema, Type, Prop> }>>
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

  min<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  min<Prop extends NumberPaths<Schema, Type>>(
    ...props: [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { min: InferPathType<Schema, Type, Prop> }>>
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

  stddev<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
    opts?: AggFnOptions,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  stddev<Prop extends NumberPaths<Schema, Type>>(
    ...args: [...Prop[], AggFnOptions] | [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { stddev: number }>>
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

  var<QueryArg extends (q: SelectFn<Schema, Type>) => AnyQuery<Schema>>(
    fn: QueryArg,
    opts?: AggFnOptions,
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<Opts, { $Agg: OptAgg<Opts> & ResolveAggregate<QueryArg> }>
  >
  var<Prop extends NumberPaths<Schema, Type>>(
    ...args: [...Prop[], AggFnOptions] | [Prop, ...Prop[]]
  ): NextBranch<
    Schema,
    Type,
    MergeOpts<
      Opts,
      {
        $Agg: OptAgg<Opts> &
          UnionToIntersection<ExpandDotPath<Prop, { variance: number }>>
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

  sort<Prop extends SortablePaths<Schema, Type, OptEdges<Opts>>>(prop: Prop): this {
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

  groupBy<Prop extends string>(
    prop: Prop,
    step?: StepInput,
  ): NextBranch<Schema, Type, MergeOpts<Opts, { $Group: Prop }>> {
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

type FilterBranch<Target extends { filter: any }> = Target

// This overload is for when the user provides NO schema argument, rely on generic default or explicit generic
export function query<
  Schema extends { types: any; locales?: any } = { types: any },
  Type extends keyof Schema['types'] & string = keyof Schema['types'] & string,
>(type: Type): Query<Schema, Type, { $Root: false; $Single: false }>

// This overload is for when the user provides NO schema argument + ID, rely on generic default or explicit generic
export function query<
  Schema extends { types: any; locales?: any } = { types: any },
  Type extends keyof Schema['types'] & string = keyof Schema['types'] & string,
>(
  type: Type,
  id: number | Partial<InferSchemaOutput<Schema, Type>>,
): Query<Schema, Type, { $Root: false; $Single: true }>

export function query<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'] & string = keyof Schema['types'] & string,
>(
  type: Type,
  target?: number | number[] | Partial<InferSchemaOutput<Schema, Type>>,
): Query<Schema, Type, { $Root: false; $Single: boolean }> {
  const ast: any = { type }
  if (target) ast.target = target
  return new Query(ast)
}

export class BasedQuery2<
  Schema extends { types: any; locales?: any } = { types: any },
  Type extends keyof Schema['types'] = any,
  Opts extends QueryOpts = {},
> extends Query<Schema, Type, MergeOpts<Opts, { $Root: true }>> {
  constructor(
    db: DbClient,
    type: Type,
    target?: number | number[] | Partial<InferSchemaOutput<Schema, Type>>,
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
              Schema,
              Type,
              ResolveInclude<ResolvedProps<Schema['types'], Type>, OptK<Opts>>
            > | null
          : PickOutput<
              Schema,
              Type,
              ResolveInclude<ResolvedProps<Schema['types'], Type>, OptK<Opts>>
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
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Opts extends QueryOpts,
> = FilterSignature<Schema, Type, Opts, FilterBranch<Query<Schema, Type, Opts>>>

type FilterProp<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Opts extends QueryOpts,
> = keyof (ResolvedProps<Schema['types'], Type> & OptEdges<Opts>) | Path<Schema, Type> | 'id'

type FilterValue<
  Op extends Operator,
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Prop,
  Opts extends QueryOpts = {},
> = Op extends '=' | '!='
  ?
      | InferPathType<Schema, Type, Prop, OptEdges<Opts>>
      | InferPathType<Schema, Type, Prop, OptEdges<Opts>>[]
  : InferPathType<Schema, Type, Prop, OptEdges<Opts>>

type FilterSignature<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Opts extends QueryOpts,
  Result,
> = {
  (
    fn: (filter: FilterFn<Schema, Type, Opts>) => FilterBranch<Query<Schema, Type, Opts>>,
  ): Result
  <Prop extends FilterProp<Schema, Type, Opts>, Op extends Operator = Operator>(
    prop: Prop,
    op: Op,
    val: FilterValue<Op, Schema, Type, Prop, Opts>,
    opts?: FilterOpts,
  ): Result
}

type SelectFn<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
> = <Prop extends keyof ResolvedProps<Schema['types'], Type>>(
  field: Prop,
) => Query<
  Schema,
  ResolvedProps<Schema['types'], Type>[Prop] extends { ref: infer Ref extends string }
    ? Ref
    : ResolvedProps<Schema['types'], Type>[Prop] extends {
          items: { ref: infer Ref extends string }
        }
      ? Ref
      : never,
  {
    $K: '*'
    $Single: false
    $Field: Prop
    $Root: false
    $Edges: FilterEdges<ResolvedProps<Schema['types'], Type>[Prop]> &
      (ResolvedProps<Schema['types'], Type>[Prop] extends { items: infer Items }
        ? FilterEdges<Items>
        : {})
  }
>

// ResolveIncludeArgs needs to stay here because it refers to Query
type ResolveIncludeArgs<Target> = Target extends (
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
  : Target extends string
    ? ResolveDotPath<Target>
    : Target

// ResolveAggregate extracts the aggregate structure from a callback function
type ResolveAggregate<Target> =
  ResolveIncludeArgs<Target> extends {
    field: infer QueryArg extends string | number | symbol
    select: { _aggregate: infer Agg }
  }
    ? { [Key in QueryArg]: Agg }
    : never

// Helper type to simplify include signature
type AnyQuery<Schema extends { types: any; locales?: any }> = Query<Schema, any, any>

// Helper type to simplify method return types
type NextBranch<
  Schema extends { types: any; locales?: any },
  Type extends keyof Schema['types'],
  Opts extends QueryOpts,
> = OptRoot<Opts> extends true ? BasedQuery2<Schema, Type, Opts> : Query<Schema, Type, Opts>

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
