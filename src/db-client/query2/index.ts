import type { QueryAst } from '../../db-query/ast/ast.js'
import type { PickOutput, ResolveInclude } from './types.js'
import type { ResolvedProps } from '../../schema/index.js'

export class BasedQuery2<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] = any,
  K extends
    | keyof ResolvedProps<S['types'], T>
    | '*'
    | '**'
    | { field: any; select: any } = '*',
  IsSingle extends boolean = false,
  SourceField extends string | number | symbol | undefined = undefined,
> {
  constructor(type: T, target?: number) {
    this.ast.type = type as string
    this.ast.target = target
  }

  ast: QueryAst = {}
  async get(): Promise<
    IsSingle extends true
      ? PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>
      : PickOutput<S, T, ResolveInclude<ResolvedProps<S['types'], T>, K>>[]
  > {
    return [] as any
  }

  include<
    F extends (
      | keyof ResolvedProps<S['types'], T>
      | '*'
      | '**'
      | ((q: SelectFn<S, T>) => BasedQuery2<S, any, any, any, any>)
    )[],
  >(
    ...props: F
  ): BasedQuery2<
    S,
    T,
    (K extends '*' ? never : K) | ResolveIncludeArgs<F[number]>,
    IsSingle,
    SourceField
  > {
    for (const prop of props) {
      let target = this.ast
      if (typeof prop === 'function') {
        const { ast } = (prop as any)((field: any) => new BasedQuery2(field))
        target.props ??= {}
        target.props[ast.type] = ast
      } else {
        const path = (prop as string).split('.')
        for (const key of path) {
          target.props ??= {}
          target = target.props[key] = {}
        }
        target.include = {}
      }
    }
    return this as any
  }
}

type SelectFn<S extends { types: any }, T extends keyof S['types']> = <
  P extends keyof ResolvedProps<S['types'], T>,
>(
  field: P,
) => BasedQuery2<
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

export type ResolveIncludeArgs<T> = T extends (
  q: any,
) => BasedQuery2<infer S, infer T, infer K, infer Single, infer SourceField>
  ? { field: SourceField; select: K }
  : T
