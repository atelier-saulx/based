import type { FilterLeaf, QueryAst } from '../../db-query/ast/ast.js'
import type {
  PickOutput,
  ResolveInclude,
  InferProp,
  Path,
  FilterOpts, // FilterOpts
  Operator,
  ResolveDotPath,
  InferPathType,
} from './types.js'
import type { ResolvedProps } from '../../schema/index.js'

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
> {
  constructor(ast: QueryAst) {
    this.ast = ast
  }
  ast: QueryAst
  include<
    F extends (
      | keyof ResolvedProps<S['types'], T>
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
        IsRoot
      > {
    for (const prop of props as (string | Function)[]) {
      let target = this.ast
      if (typeof prop === 'function') {
        prop((prop: string) => {
          const path = prop.split('.')
          for (const key of path) {
            target.props ??= {}
            target = target.props[key] = {}
          }
          return new QueryBranch(target)
        })
      } else {
        const path = prop.split('.')
        for (const key of path) {
          target.props ??= {}
          target = target.props[key] = {}
        }
        target.include = {}
      }
    }
    return this as any
  }

  filter<P extends keyof ResolvedProps<S['types'], T> | Path<S['types'], T>>(
    prop: P,
    op: Operator,
    val: InferPathType<S, T, P>,
    opts?: FilterOpts,
  ): this {
    let target: FilterLeaf = (this.ast.filter ??= {})
    const path = (prop as string).split('.')
    for (const key of path) {
      target.props ??= {}
      target = target.props[key] = {}
    }
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
> extends QueryBranch<S, T, K, IsSingle, undefined, true> {
  constructor(type: T, target?: number) {
    super({})
    this.ast.type = type as string
    this.ast.target = target
  }
  async get(): Promise<
    IsSingle extends true
      ? PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>
      : PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>[]
  > {
    return [] as any
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
  P
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
  any
>
  ? { field: SourceField; select: K }
  : T extends string
    ? ResolveDotPath<T>
    : T
