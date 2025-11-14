import type { BasedDbQuery, Operator } from '@based/db'
import { assert, isNatural, isRecord } from './shared.js'
import { parseProp, type SchemaProp } from './prop.js'
import type { Schema } from './schema.js'

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
  : SchemaTypeObj<strict> | ({ props: never } & SchemaProps<strict>)

export const parseType = (type: unknown, schema: Schema): SchemaType<true> => {
  assert(isRecord(type))
  let typeProps: unknown
  if (type.props) {
    typeProps = type.props
    assert(type.hooks === undefined || isRecord(type.hooks))
    assert(type.blockCapacity === undefined || isNatural(type.blockCapacity))
  } else {
    typeProps = type
  }
  assert(isRecord(typeProps))
  const props: SchemaProps<true> = {}
  for (const key in typeProps) {
    props[key] = parseProp(typeProps[key], schema)
  }
  return {
    props,
  }
}
