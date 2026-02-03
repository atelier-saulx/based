import type { InferSchemaOutput, PickOutput, ResolveInclude } from './types.js'

export class BasedQuery2<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] = any,
  K extends keyof S['types'][T]['props'] | '*' | '**' = '*',
  IsSingle extends boolean = false,
> {
  constructor(type: T, id?: number) {
    this.type = type
    this.id = id
  }
  type: T
  id?: number

  async get(): Promise<
    IsSingle extends true
      ? PickOutput<S, T, ResolveInclude<S['types'][T]['props'], K>>
      : PickOutput<S, T, ResolveInclude<S['types'][T]['props'], K>>[]
  > {
    return [] as any
  }

  include<F extends (keyof S['types'][T]['props'] | '*' | '**')[]>(
    ...fields: F
  ): BasedQuery2<S, T, (K extends '*' ? never : K) | F[number], IsSingle> {
    return this as any
  }
}
