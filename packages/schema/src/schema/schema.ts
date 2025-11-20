import {
  assert,
  deleteUndefined,
  isBoolean,
  isFunction,
  isRecord,
  isString,
} from './shared.js'
import { parseType, type SchemaType } from './type.js'
import { langCodesMap, type LangName } from './lang.js'
import type { SchemaProp } from './prop.js'

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

const parseRefs = (
  types: SchemaTypes<true>,
  type: keyof SchemaTypes<true>,
  prop: SchemaProp<true>,
  path: string[],
) => {
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
    if (!inverse.type) {
      inverse.type = 'references'
      inverse.items = {
        type: 'reference',
        ref: type,
        prop: dotPath,
      }
    }
    if (inverse.items) {
      inverse = inverse.items
    }

    for (const key in inverse) {
      if (key[0] === '$') {
        prop[key] = inverse[key]
      }
    }

    for (const key in prop) {
      if (key[0] === '$') {
        inverse[key] = prop[key]
      }
    }

    assert(inverse.ref === type)
    assert(inverse.prop === dotPath)
  } else if ('items' in prop) {
    parseRefs(types, type, prop.items, path)
  } else if ('props' in prop) {
    for (const k in prop.props) {
      parseRefs(types, type, prop.props[k], [...path, k])
    }
  }
}

export const parseSchema = (v: unknown): Schema<true> => {
  assert(isRecord(v))
  assert(isRecord(v.types))
  assert(v.version === undefined || isString(v.version))
  assert(v.locales === undefined || isLocales(v.locales))
  assert(v.migrations === undefined || isMigrations(v.migrations))
  assert(v.defaultTimezone === undefined || isString(v.defaultTimezone))

  const types: SchemaTypes<true> = {}
  for (const key in v.types) {
    types[key] = parseType(v.types[key])
  }

  // handle references here now
  for (const type in types) {
    for (const k in types[type].props) {
      parseRefs(types, type, types[type].props[k], [k])
    }
  }

  return deleteUndefined({
    version: v.version,
    locales: v.locales,
    defaultTimezone: v.defaultTimezone,
    migrations: v.migrations,
    types,
  })
}
