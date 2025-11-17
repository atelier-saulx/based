import type { BasedDbQuery, Operator } from '@based/db'
import type { Schema } from './schema.ts'
import {
  assert,
  deleteUndefined,
  isBoolean,
  isNatural,
  isRecord,
} from './shared.ts'
import { parseProp, type SchemaProp } from './prop.ts'
import { isHooks } from './hooks.ts'

type SchemaHooks = {
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

type SchemaProps<strict = true> = Record<string, SchemaProp<strict>>
type SchemaTypeObj<strict = false> = {
  hooks?: SchemaHooks
  blockCapacity?: number
  capped?: number
  partial?: boolean
  props: SchemaProps<strict>
}

export type SchemaType<strict = false> = strict extends true
  ? SchemaTypeObj<strict>
  : SchemaTypeObj<strict> | ({ props?: never } & SchemaProps<strict>)

const parseProps = (typeProps: unknown, schema: Schema) => {
  assert(isRecord(typeProps))
  const props: SchemaProps<true> = {}
  for (const key in typeProps) {
    props[key] = parseProp(typeProps[key], schema)
  }
  return props
}

export const parseType = (type: unknown, schema: Schema): SchemaType<true> => {
  assert(isRecord(type))

  if (type.props === undefined) {
    return { props: parseProps(type, schema) }
  }

  assert(type.hooks === undefined || isHooks<SchemaHooks>(type.hooks))
  assert(type.blockCapacity === undefined || isNatural(type.blockCapacity))
  assert(type.capped === undefined || isNatural(type.capped))
  assert(type.partial === undefined || isBoolean(type.partial))

  const result = {
    hooks: type.hooks,
    blockCapacity: type.blockCapacity,
    capped: type.capped,
    partial: type.partial,
    props: parseProps(type.props, schema),
  }

  deleteUndefined(result)

  return result
}
