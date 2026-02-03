import type { QueryAst } from '../../db-query/ast/ast.js'
import type { InferSchemaOutput, PickOutput, ResolveInclude } from './types.js'

export class BasedQuery2<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] = any,
  K extends keyof S['types'][T]['props'] | '*' | '**' = '*',
  IsSingle extends boolean = false,
> {
  constructor(type: T, target?: number) {
    this.ast.type = type as string
    this.ast.target = target
  }
  ast: QueryAst = {}
  async get(): Promise<
    IsSingle extends true
      ? PickOutput<S, T, ResolveInclude<S['types'][T]['props'], K>>
      : PickOutput<S, T, ResolveInclude<S['types'][T]['props'], K>>[]
  > {
    return [] as any
  }

  include<F extends (keyof S['types'][T]['props'] | '*' | '**')[]>(
    ...props: F
  ): BasedQuery2<S, T, (K extends '*' ? never : K) | F[number], IsSingle> {
    for (const prop of props) {
      const path = (prop as string).split('.')
      let target = this.ast
      for (const key of path) {
        target.props ??= {}
        target = target.props[key] = {}
      }
      target.include = {}
    }
    return this as any
  }
}
