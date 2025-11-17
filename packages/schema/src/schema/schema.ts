import assert from 'assert'
import { isBoolean, isFunction, isRecord, isString } from './shared.ts'
import { parseType, type SchemaType } from './type.ts'
import { langCodesMap, type LangName } from './lang.ts'

type SchemaTypes<strict = true> = Record<string, SchemaType<strict>>
type SchemaLocales = Partial<
  Record<
    LangName,
    | true
    | {
        required?: boolean
        fallback?: LangName // not multiple - 1 is enough else it becomes too complex
      }
  >
>

type MigrateFn = (
  node: Record<string, any>,
) => Record<string, any> | [string, Record<string, any>]
type MigrateFns = Record<string, MigrateFn>
type Migrations = {
  version: string
  migrate: MigrateFns
}[]
export type Schema<strict = false> = {
  version?: string
  types: SchemaTypes<strict>
  defaultTimezone?: string
  locales?: SchemaLocales
  migrations?: Migrations
}

const isMigrations = (v: unknown): v is Migrations =>
  isRecord(v) &&
  Object.values(v).every(
    (m) =>
      isRecord(m) &&
      isString(m.version) &&
      isRecord(m.migrate) &&
      Object.values(m.migrate).every(isFunction),
  )

const isLocales = (v: unknown): v is SchemaLocales =>
  isRecord(v) &&
  Object.entries(v).every(([k, v]) => {
    if (langCodesMap.has(k)) {
      // TODO make more strict!
      return isBoolean(v) || isRecord(v)
    }
  })

export const parseSchema = (v: unknown): Schema<true> => {
  assert(isRecord(v))
  assert(isRecord(v.types))
  assert(v.version === undefined || isString(v.version))
  assert(v.locales === undefined || isLocales(v.locales))
  assert(v.migrations === undefined || isMigrations(v.migrations))
  assert(v.defaultTimezone === undefined || isString(v.defaultTimezone))

  const types = {}
  for (const key in v.types) {
    types[key] = parseType(v.types[key], v as Schema)
  }

  return {
    version: v.version,
    locales: v.locales,
    defaultTimezone: v.defaultTimezone,
    migrations: v.migrations,
    types,
  }
}
