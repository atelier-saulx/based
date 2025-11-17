import { assert, isBoolean, isFunction, isRecord, isString } from './shared.ts'
import { parseType, type SchemaType } from './type.ts'
import { langCodesMap, type LangName } from './lang.ts'
import type { SchemaProp } from './prop.ts'

type SchemaTypes<strict = false> = Record<string, SchemaType<strict>>
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

  const types: SchemaTypes<true> = {}
  for (const key in v.types) {
    types[key] = parseType(v.types[key], v as Schema)
  }

  // handle references here now
  for (const type in types) {
    const parseRefs = (prop: SchemaProp<true>, path: string[]) => {
      if (prop.type === 'reference') {
        let inverse: any = types[prop.ref]
        for (const key of prop.prop.split('.')) {
          let next = 'props' in inverse ? inverse.props?.[key] : inverse[key]
          if (!next) {
            inverse.props ??= {}
            next = inverse.props[key] = {}
          }
          inverse = next
        }
        const dotPath = path.join('.')
        inverse.ref ??= type
        inverse.prop ??= dotPath
        assert(inverse.ref === type)
        assert(inverse.prop === dotPath)
      } else if ('items' in prop) {
        parseRefs(prop.items, path)
      } else if ('props' in prop) {
        for (const k in prop.props) {
          parseRefs(prop.props[k], [...path, k])
        }
      }
    }
    for (const k in types[type].props) {
      parseRefs(types[type].props[k], [k])
    }
  }

  return {
    version: v.version,
    locales: v.locales,
    defaultTimezone: v.defaultTimezone,
    migrations: v.migrations,
    types,
  }
}
