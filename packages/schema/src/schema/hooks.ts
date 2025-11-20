import type { BasedDbQuery, Operator } from '@based/db'
import { isFunction, isRecord } from './shared.js'

// type BasedDbQuery = any
// type Operator = any

export type SchemaHooks = {
  create?: (payload: Record<string, any>) => void | Record<string, any>
  update?: (payload: Record<string, any>) => void | Record<string, any>
  read?: (result: Record<string, any>) => void | null | Record<string, any>
  search?: (query: BasedDbQuery, fields: Set<string>) => void
  include?: (
    query: BasedDbQuery,
    fields: Map<
      string,
      {
        field: string
        opts?: any // temp this type
      }
    >,
  ) => void
  filter?: (
    query: BasedDbQuery,
    field: string,
    operator: Operator,
    value: any,
  ) => void
  groupBy?: (query: BasedDbQuery, field: string) => void
  aggregate?: (query: BasedDbQuery, fields: Set<string>) => void
}

export type SchemaPropHooks = {
  create?: (value: any, payload: Record<string, any>) => any
  update?: (value: any, payload: Record<string, any>) => any
  read?: (value: any, result: Record<string, any>) => any
  aggregate?: (query: BasedDbQuery, fields: Set<string>) => void
  search?: (query: BasedDbQuery, fields: Set<string>) => void
  groupBy?: (query: BasedDbQuery, field: string) => void
  filter?: (
    query: BasedDbQuery,
    field: string,
    operator: Operator,
    value: any,
  ) => void
  include?: (
    query: BasedDbQuery,
    fields: Map<
      string,
      {
        field: string
        opts?: any // temp this type
      }
    >,
  ) => void
}

export const isHooks = <Hooks extends SchemaHooks | SchemaPropHooks>(
  v: unknown,
): v is Hooks => isRecord(v) && Object.values(v).every(isFunction)
