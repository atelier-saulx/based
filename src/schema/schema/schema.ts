import {
  assert,
  assertExpectedProps,
  deleteUndefined,
  isFunction,
  isRecord,
  isString,
  type RequiredIfStrict,
} from './shared.js'
import { parseType, type SchemaType } from './type.js'
import { inspect } from 'node:util'
import { postParseRefs } from './reference.js'
import hash from '../../hash/hash.js'
import { parseLocales, type SchemaLocales } from './locales.js'
export type SchemaTypes<strict = false> = Record<string, SchemaType<strict>>
export type SchemaMigrateFn = (
  node: Record<string, any>,
) => Record<string, any> | [string, Record<string, any>]
export type SchemaMigrateFns = Record<string, SchemaMigrateFn>
export type SchemaMigrations = {
  version: string
  migrate: SchemaMigrateFns
}[]
export type Schema<strict = false> = {
  version?: string
  types: SchemaTypes<strict>
  defaultTimezone?: string
  migrations?: SchemaMigrations
  locales?: SchemaLocales<strict>
} & RequiredIfStrict<{ hash: number }, strict>

export type SchemaIn = Schema<false> | Schema<true>
export type SchemaOut = Schema<true>

type NormalizeProp<T> = T extends string
  ? { type: T }
  : T extends readonly (infer U)[]
    ? { type: 'enum'; enum: U[] }
    : T extends { type: 'object'; props: infer P }
      ? Omit<T, 'props'> & {
          type: 'object'
          props: { [K in keyof P]: NormalizeProp<P[K]> }
        }
      : T extends { props: infer P }
        ? Omit<T, 'props'> & {
            type: 'object'
            props: { [K in keyof P]: NormalizeProp<P[K]> }
          }
        : T extends { items: infer I }
          ? Omit<T, 'items'> & { type: 'references'; items: NormalizeProp<I> }
          : T extends { ref: string }
            ? T & { type: 'reference' }
            : T extends { enum: any[] }
              ? T & { type: 'enum' }
              : T

type NormalizeType<T> = T extends { props: infer P }
  ? Omit<T, 'props'> & { props: { [K in keyof P]: NormalizeProp<P[K]> } }
  : { props: { [K in keyof T]: NormalizeProp<T[K]> } }

type ResolveSchema<S extends SchemaIn> = Omit<S, 'types' | 'locales'> & {
  hash: number
  locales: SchemaLocales<true>
  types: {
    [K in keyof S['types']]: NormalizeType<S['types'][K]>
  }
} & SchemaOut

const isMigrations = (v: unknown): v is SchemaMigrations =>
  isRecord(v) &&
  Object.values(v).every(
    (m) =>
      isRecord(m) &&
      isString(m.version) &&
      isRecord(m.migrate) &&
      Object.values(m.migrate).every(isFunction),
  )

const getPath = (
  obj: Record<string, unknown>,
  def: Record<string, unknown>,
  path: string[],
): string[] | undefined => {
  for (const k in obj) {
    const v = obj[k]
    if (v === def) {
      return path
    }
    if (isRecord(v)) {
      const res = getPath(v, def, [...path, k])
      if (res) return res
    }
  }
}

let tracking: unknown
let path: string[] = []
let value: any

const _track = <P extends Record<string, unknown>>(
  input: P,
  depth: number,
  target: P,
): P =>
  new Proxy(input, {
    get(obj, key: string) {
      let val = obj[key]
      if (tracking !== target) {
        return val
      }
      value = val
      path[depth] = key
      if (path.length > depth + 1) path = path.slice(0, depth + 1)
      return isRecord(val) ? _track(val, depth + 1, target) : val
    },
  })
const track = <P extends Record<string, unknown>>(input: P): P => {
  tracking = input
  return _track(input, 0, input)
}

/*
  This returns a "public" parsed schema, suitable for external users
*/
export const parseSchema = <S extends SchemaIn>(input: S): ResolveSchema<S> => {
  const v: unknown = track(input)
  assert(isRecord(v), 'Schema should be record')
  try {
    const locales = parseLocales(v.locales)
    assert(isRecord(v.types), 'Types should be record')
    assert(
      v.version === undefined || isString(v.version),
      'Version should be string',
    )
    assert(
      v.migrations === undefined || isMigrations(v.migrations),
      'Invalid migrations',
    )
    assert(
      v.defaultTimezone === undefined ||
        (isString(v.defaultTimezone) &&
          Intl.DateTimeFormat(undefined, { timeZone: v.defaultTimezone })),
      'Invalid Default Timezone',
    )
    let types: SchemaTypes<true> = {}
    for (const key in v.types) {
      const type = v.types[key]
      assert(isRecord(type), 'Type should be object')
      types[key] = parseType(type, locales)
    }

    const result = deleteUndefined({
      version: v.version,
      locales: locales,
      defaultTimezone: v.defaultTimezone,
      migrations: v.migrations,
      types,
    }) as SchemaOut

    assertExpectedProps(result, v)

    const tracked = track(result)
    for (const type in tracked.types) {
      for (const k in tracked.types[type].props) {
        postParseRefs(tracked.types, type, tracked.types[type].props[k], [k])
      }
    }

    // TODO we can remove hash from here after we finish new schema defs (internal schema)
    result.hash = hash(result)

    return result as ResolveSchema<S>
  } catch (e) {
    if (tracking) {
      e = Error(`${path.join('.')}: ${inspect(value)} - ${e}`, { cause: e })
    }
    throw e
  }
}
