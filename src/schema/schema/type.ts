import {
  assert,
  deleteUndefined,
  isBoolean,
  isNatural,
  isRecord,
} from './shared.js'
import { parseProp, type SchemaProp } from './prop.js'
import { isHooks, type SchemaHooks } from './hooks.js'
import type { SchemaOut } from './schema.js'

export type SchemaProps<strict = true> = Record<string, SchemaProp<strict>>

type SchemaTypeObj<strict = false> = {
  hooks?: SchemaHooks
  blockCapacity?: number
  insertOnly?: boolean
  capped?: number
  partial?: boolean
  props: SchemaProps<strict>
}

export type SchemaType<strict = false> = strict extends true
  ? SchemaTypeObj<strict>
  : SchemaTypeObj<strict> | ({ props?: never } & SchemaProps<strict>)

const parseProps = (
  typeProps: Record<string, unknown>,
  locales: SchemaOut['locales'],
) => {
  const props: SchemaProps<true> = {}
  for (const key in typeProps) {
    props[key] = parseProp(typeProps[key], locales)
  }
  return props
}

export const parseType = (
  type: Record<string, unknown>,
  locales: SchemaOut['locales'],
): SchemaType<true> => {
  if (type.props === undefined) {
    return { props: parseProps(type, locales) }
  }
  assert(
    type.hooks === undefined || isHooks<SchemaHooks>(type.hooks),
    'Invalid hooks',
  )
  assert(
    type.blockCapacity === undefined || isNatural(type.blockCapacity),
    'Should be natural number',
  )
  assert(
    type.capped === undefined || isNatural(type.capped),
    'Should be natural number',
  )
  assert(
    type.partial === undefined || isBoolean(type.partial),
    'Should be boolean',
  )
  assert(
    type.insertOnly === undefined || isBoolean(type.insertOnly),
    'Should be boolean',
  )
  assert(isRecord(type.props), 'Should be record')
  const result = {
    hooks: type.hooks,
    blockCapacity: type.blockCapacity,
    insertOnly: type.insertOnly,
    capped: type.capped,
    partial: type.partial,
    props: parseProps(type.props, locales),
  }

  return deleteUndefined(result)
}
