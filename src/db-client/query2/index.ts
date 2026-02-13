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
} from './types.js'
import type { ResolvedProps, SchemaOut } from '../../schema/index.js'
import { astToQueryCtx } from '../../db-query/ast/toCtx.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import type { DbClient } from '../../sdk.js'
import { proxyResult } from './result.js'

class QueryBranch<
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
      | ((q: SelectFn<S, T>) => QueryBranch<S, any, any, any, any>)
    )[],
  >(
    ...props: F
  ): IsRoot extends true
    ? BasedQuery2<
        S,
        T,
        (K extends '*' ? never : K) | ResolveIncludeArgs<F[number]>,
        IsSingle
      >
    : QueryBranch<
        S,
        T,
        (K extends '*' ? never : K) | ResolveIncludeArgs<F[number]>,
        IsSingle,
        SourceField,
        IsRoot,
        EdgeProps
      > {
    for (const prop of props as (string | Function)[]) {
      if (typeof prop === 'function') {
        prop((prop: string) => new QueryBranch(traverse(this.ast, prop)))
      } else {
        traverse(this.ast, prop).include = {}
      }
    }
    return this as any
  }

  filter(
    fn: (
      filter: FilterFn<S, T, EdgeProps>,
    ) => FilterBranch<QueryBranch<S, T, any, any, any, any, EdgeProps>>,
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
    ) => FilterBranch<QueryBranch<S, T, any, any, any, any, EdgeProps>>,
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
    ) => FilterBranch<QueryBranch<S, T, any, any, any, any, EdgeProps>>,
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
        const branch = new QueryBranch(target)
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

export function query<
  S extends { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(type: T): QueryBranch<S, T, '*', false>

export function query<
  S extends { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  id: number | Partial<InferSchemaOutput<S, T>>,
): QueryBranch<S, T, '*', true>

export function query<
  S extends { types: any },
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  type: T,
  id?: number | Partial<InferSchemaOutput<S, T>>,
): QueryBranch<S, T, '*', boolean> {
  const ast: any = { type }
  if (id) ast.target = id
  return new QueryBranch<S, T, '*', any>(ast)
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
> extends QueryBranch<S, T, K, IsSingle, undefined, true, {}> {
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
    IsSingle extends true
      ? PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>> | null
      : PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>[]
  > {
    if (!this.ast.props) {
      this.include('*')
    }

    if (!this.db.schema) {
      await this.db.once('schema')
    }
    await this.db.isModified()
    const ctx = astToQueryCtx(
      this.db.schema!,
      this.ast,
      new AutoSizedUint8Array(1000),
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
  FilterBranch<QueryBranch<S, T, any, any, any, any, EdgeProps>>
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
    ) => FilterBranch<QueryBranch<S, T, any, any, any, any, EdgeProps>>,
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
) => QueryBranch<
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

// ResolveIncludeArgs needs to stay here because it refers to QueryBranch
export type ResolveIncludeArgs<T> = T extends (
  q: any,
) => QueryBranch<
  infer S,
  infer T,
  infer K,
  infer Single,
  infer SourceField,
  any,
  any
>
  ? { field: SourceField; select: K }
  : T extends string
    ? ResolveDotPath<T>
    : T

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
