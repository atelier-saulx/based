import type { InferSchemaOutput, PickOutput, ResolveInclude } from './types.js'

export class BasedQuery2<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] = any,
  K extends (keyof S['types'][T]['props'] | '*' | '**') | 'ALL' = 'ALL',
> {
  constructor(type: T) {
    this.type = type
  }
  type: T

  async get(): Promise<{
    data: (K extends 'ALL'
      ? InferSchemaOutput<S, T>
      : PickOutput<
          S,
          T,
          ResolveInclude<S['types'][T]['props'], Exclude<K, 'ALL'>>
        >)[]
  }> {
    return { data: [] }
  }

  include<F extends (keyof S['types'][T]['props'] | '*' | '**')[]>(
    ...fields: F
  ): BasedQuery2<S, T, (K extends 'ALL' ? never : K) | F[number]> {
    return this as any
  }
}
