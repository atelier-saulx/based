import {
  assert,
  deleteUndefined,
  isBoolean,
  isFunction,
  isRecord,
  isString,
  type RequiredIfStrict,
} from './shared.js'
import { parseType, type SchemaType } from './type.js'
import { langCodesMap, type LangName } from './lang.js'
import type { SchemaProp } from './prop.js'
import { hash } from '@based/hash'
import { inspect } from 'node:util'

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
} & RequiredIfStrict<{ hash: number }, strict>

export type SchemaIn = Schema<false>
export type SchemaOut = Schema<true>

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
    assert(prop.ref in types, `Ref type ${prop.ref} should be defined`)
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

    assert(inverse.ref === type, `Ref should be ${type}`)
    assert(inverse.prop === dotPath, `Prop should be ${dotPath}`)
  } else if ('items' in prop) {
    parseRefs(types, type, prop.items, path)
  } else if ('props' in prop) {
    for (const k in prop.props) {
      parseRefs(types, type, prop.props[k], [...path, k])
    }
  }
}

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

let tracking
let path: string[] = []
let value: any

const _track = <P extends Record<string, unknown>>(
  input: P,
  depth: number,
): P =>
  new Proxy(input, {
    get(obj, key: string) {
      let val = obj[key]
      value = val
      path[depth] = key
      if (path.length > depth + 1) path = path.slice(0, depth + 1)
      return isRecord(val) ? _track(val, depth + 1) : val
    },
  })
const track = <P extends Record<string, unknown>>(input: P): P => {
  tracking = input
  return _track(input, 0)
}

export const parseSchema = (input: SchemaIn): SchemaOut => {
  const v: unknown = track(input)
  assert(isRecord(v), 'Schema should be record')
  try {
    assert(isRecord(v.types), 'Types should be record')
    assert(
      v.version === undefined || isString(v.version),
      'Version should be string',
    )
    assert(v.locales === undefined || isLocales(v.locales), 'Invalid locales')
    assert(
      v.migrations === undefined || isMigrations(v.migrations),
      'Invalid migrations',
    )
    assert(
      v.defaultTimezone === undefined || isString(v.defaultTimezone),
      'Invalid Default Timezone',
    )

    let types: SchemaTypes<true> = {}
    for (const key in v.types) {
      const type = v.types[key]
      assert(isRecord(type), 'Type should be object')
      types[key] = parseType(type)
    }

    const result = deleteUndefined({
      version: v.version,
      locales: v.locales,
      defaultTimezone: v.defaultTimezone,
      migrations: v.migrations,
      types,
    }) as SchemaOut

    const tracked = track(result)
    for (const type in tracked.types) {
      for (const k in tracked.types[type].props) {
        parseRefs(tracked.types, type, tracked.types[type].props[k], [k])
      }
    }

    result.hash = hash(result)
    return result
  } catch (e) {
    throw Error(`${path.join('.')}: ${inspect(value)} - ${e}`, { cause: e })
  }
}
