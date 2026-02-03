import type { InferSchemaOutput } from './types.js'

export class BasedQuery2<
  S extends { types: any } = { types: any },
  T extends keyof S['types'] = any,
> {
  constructor(type: T) {
    this.type = type
  }
  type: T
  async get(): Promise<{ data: InferSchemaOutput<S, T>[] }> {
    // Implementation will come later, just typing for now
    return { data: [] }
  }
}
