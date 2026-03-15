import type { FilterAst, QueryAst } from '../ast/ast.js'
import type {
  Path,
  FilterOpts,
  Operator,
  InferPathType,
  InferSchemaOutput,
  NumberPaths,
  SortablePaths,
  ExpandDotPath,
  UnionToIntersection,
  AggFnOptions,
  QueryOpts,
  OptK,
  OptEdges,
  OptAgg,
  MergeOpts,
  FilterBranch,
  FilterFn,
  FilterProp,
  FilterValue,
  SelectFn,
  ResolveIncludeArgs,
  ResolveAggregate,
  AnyQuery,
  NextBranch,
} from './types.js'
import type { ResolvedProps } from '../../schema/index.js'
import type { StepInput } from '../ast/aggregates.js'
import { Interval } from '../../zigTsExports.js'

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

export class Query<
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
      (Schema['locales'] extends Record<string, any>
        ? keyof Schema['locales']
        : string),
  >(
    locale: Locale,
  ): NextBranch<{ types: Schema['types']; locales: Locale }, Type, Opts> {
    this.ast.locale = locale
    return this as any
  }

  include<
    QueryArg extends [
      (
        | 'id'
        | (keyof (ResolvedProps<Schema['types'], Type> & OptEdges<Opts>) &
            string)
        | Path<Schema, Type>
        | '*'
        | '**'
        | ((q: SelectFn<Schema, Type>) => AnyQuery<Schema>)
      ),
      ...(
        | 'id'
        | (keyof (ResolvedProps<Schema['types'], Type> & OptEdges<Opts>) &
            string)
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
    fn: (
      filter: FilterFn<Schema, Type, Opts>,
    ) => FilterBranch<Query<Schema, Type, Opts>>,
  ): FilterBranch<this>
  filter<
    Prop extends FilterProp<Schema, Type, Opts>,
    Op extends Operator = Operator,
  >(
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
    fn: (
      filter: FilterFn<Schema, Type, Opts>,
    ) => FilterBranch<Query<Schema, Type, Opts>>,
  ): FilterBranch<this>
  and<
    Prop extends FilterProp<Schema, Type, Opts>,
    Op extends Operator = Operator,
  >(
    prop: Prop,
    op: Op,
    val: FilterValue<Op, Schema, Type, Prop, Opts>,
    opts?: FilterOpts,
  ): FilterBranch<this>
  and(prop: any, op?: any, val?: any, opts?: any): FilterBranch<this> {
    return this.filter(prop, op, val, opts)
  }

  or(
    fn: (
      filter: FilterFn<Schema, Type, Opts>,
    ) => FilterBranch<Query<Schema, Type, Opts>>,
  ): FilterBranch<this>
  or<
    Prop extends FilterProp<Schema, Type, Opts>,
    Op extends Operator = Operator,
  >(
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
          UnionToIntersection<
            ExpandDotPath<Prop, { max: InferPathType<Schema, Type, Prop> }>
          >
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
          UnionToIntersection<
            ExpandDotPath<Prop, { min: InferPathType<Schema, Type, Prop> }>
          >
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

  sort<Prop extends SortablePaths<Schema, Type, OptEdges<Opts>>>(
    prop: Prop,
  ): this {
    this.ast.sort = { prop: prop as string }
    return this as any
  }

  order(order: 'asc' | 'desc'): this {
    this.ast.order = order || 'asc'
    return this as any
  }

  range(start: number, end?: number): this {
    this.ast.range = { start, end: end ?? start + 1000 }
    return this as any
  }

  groupBy<Prop extends string>(
    ...args: [Prop, ...Prop[]] | [...Prop[], StepInput]
  ): NextBranch<Schema, Type, MergeOpts<Opts, { $Group: Prop }>> {
    if (args.length === 0) {
      throw new Error('Query: groupBy expects at least one argument')
    }

    let step: StepInput | undefined
    let props: string[]

    const intervalStrings = Object.keys(Interval)
    const lastArg = args[args.length - 1]
    if (
      typeof lastArg === 'object' &&
      lastArg !== null &&
      !Array.isArray(lastArg)
    ) {
      step = lastArg as StepInput
      props = args.slice(0, -1) as string[]
    } else if (typeof lastArg === 'number' && !isNaN(lastArg)) {
      step = lastArg as StepInput
      props = args.slice(0, -1) as string[]
    } else if (
      typeof lastArg === 'string' &&
      args.length > 1 &&
      intervalStrings.includes(lastArg)
    ) {
      step = lastArg as StepInput
      props = args.slice(0, -1) as string[]
    } else {
      props = args as string[]
    }

    for (const prop of props) {
      const parts = prop.split('.')
      let target = this.ast
      let field: string = prop
      if (parts.length > 1) {
        field = parts.pop()!
        target = traverse(this.ast, parts.join('.'))
      }
      target.groupBy = target.groupBy || []
      const groupNode: any = { prop: field as any }
      if (step) {
        if (typeof step === 'object') {
          const s = step as any
          if (s.step) groupNode.step = s.step
          if (s.timeZone) groupNode.timeZone = s.timeZone
          if (s.display) groupNode.display = s.display
        } else {
          groupNode.step = step
        }
      }
      target.groupBy.push(groupNode)
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

export function query<
  Schema extends { types: any; locales?: any } = { types: any },
  Type extends keyof Schema['types'] & string = keyof Schema['types'] & string,
>(type: Type): Query<Schema, Type, { $Root: false; $Single: false }>

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
