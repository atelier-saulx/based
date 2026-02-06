import type { FilterLeaf, QueryAst } from '../../db-query/ast/ast.js'
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

  filter<
    P extends
      | keyof (ResolvedProps<S['types'], T> & EdgeProps)
      | Path<S['types'], T>,
  >(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P>,
    opts?: FilterOpts,
  ): this {
    const target = traverse((this.ast.filter ??= {}), prop as string)
    target.ops ??= []
    target.ops.push({ op, val })
    return this
  }
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
    this.ast.target = target
    this.db = db
  }
  db: DbClient
  async get(): Promise<
    IsSingle extends true
      ? PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>
      : PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>[]
  > {
    if (!this.ast.props) {
      this.include('*')
    }
    // console.dir(this.ast, { depth: null })

    if (!this.db.schema) {
      await this.db.once('schema')
    }
    await this.db.isModified()
    const ctx = astToQueryCtx(
      this.db.schema!,
      this.ast,
      new AutoSizedUint8Array(1000),
    )
    // console.dir(ctx.readSchema, { depth: null })
    const result = await this.db.hooks.getQueryBuf(ctx.query)
    return proxyResult(result, ctx.readSchema) as any
  }
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
