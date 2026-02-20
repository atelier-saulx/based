import {
  assert,
  assertExpectedProps,
  deleteUndefined,
  isFunction,
  isRecord,
  isString,
  type RequiredIfStrict,
} from './shared.js'
import { type LangName, type SchemaLocale } from './locales.js'
import { parseType, type SchemaType } from './type.js'
import { inspect } from 'node:util'
import { postParseRefs } from './reference.js'
import hash from '../../hash/hash.js'
import { parseLocales, type SchemaLocales } from './locales.js'
import { type SchemaHooks } from './hooks.js'
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
            ? {
                [K in keyof T]: K extends `$${string}`
                  ? NormalizeProp<T[K]>
                  : T[K]
              } & { type: 'reference' }
            : T extends { enum: readonly any[] }
              ? T & { type: 'enum' }
              : T

// Utility to normalize properties in an object
type NormalizeEdges<T> = {
  [K in keyof T]: NormalizeProp<T[K]>
}

// Utility to convert a Union to an Intersection
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

// Helper to find Props in other types that reference TName with a specific 'prop' field
type GetBackRefs<Types, TName> = UnionToIntersection<
  {
    [K in keyof Types]: (
      Types[K] extends { props: infer P } ? P : Types[K]
    ) extends infer Props
      ? {
          [P in keyof Props as Props[P] extends {
            ref: TName
            prop: infer BackProp extends string
          }
            ? BackProp
            : Props[P] extends {
                  items: { ref: TName; prop: infer BackProp extends string }
                }
              ? BackProp
              : never]: {
            type: 'references'
            items: {
              type: 'reference'
              ref: K & string
              prop: P & string
            } & NormalizeEdges<
              Props[P] extends { items: infer I }
                ? Omit<I, 'ref' | 'prop' | 'type'>
                : Omit<Props[P], 'ref' | 'prop' | 'type'>
            >
          }
        }
      : never
  }[keyof Types]
>

// ResolvedProps combines explicit props with inferred back-reference props
export type ResolvedProps<
  Types,
  TName extends keyof Types,
  Props = NormalizeType<Types[TName]> extends { props: infer P } ? P : {},
  BackRefs = GetBackRefs<Types, TName>,
> = string extends keyof Types
  ? any
  : {
      [K in keyof (Props &
        ([BackRefs] extends [never]
          ? {}
          : Omit<BackRefs, keyof Props>)) as Extract<K, string>]: (Props &
        ([BackRefs] extends [never] ? {} : Omit<BackRefs, keyof Props>))[K]
    }

type NormalizeType<T> = T extends { props: infer P }
  ? Omit<T, 'props'> & { props: { [K in keyof P]: NormalizeProp<P[K]> } }
  : { props: { [K in keyof T]: NormalizeProp<T[K]> } }

// Helper to extract props from a type definition (explicit or shorthand)
type GetProps<T> = T extends { props: infer P } ? P : T

// Helper to find "Incoming Claims" - properties on TargetRef that explicitly point to MyType.MyProp
type GetIncomingClaims<Types, TargetRef extends keyof Types, MyType, MyProp> = {
  [K in keyof GetProps<Types[TargetRef]>]: GetProps<
    Types[TargetRef]
  >[K] extends infer TargetProp
    ? TargetProp extends { ref: MyType; prop: MyProp }
      ? K
      : TargetProp extends { items: { ref: MyType; prop: MyProp } }
        ? K
        : never
    : never
}[keyof GetProps<Types[TargetRef]>]

type ValidateProp<Prop, Types, TName, PName> = Prop extends {
  ref: infer Ref extends string
  prop: infer BackProp extends string
}
  ? Ref extends keyof Types
    ? GetIncomingClaims<Types, Ref, TName, PName> extends infer Claims
      ? [Claims] extends [never]
        ? Prop
        : BackProp extends Claims
          ? Prop
          : { ref: Ref; prop: Claims } & Omit<Prop, 'ref' | 'prop'>
      : never
    : Prop
  : Prop extends {
        items: {
          ref: infer Ref extends string
          prop: infer BackProp extends string
        }
      }
    ? Ref extends keyof Types
      ? GetIncomingClaims<Types, Ref, TName, PName> extends infer Claims
        ? [Claims] extends [never]
          ? Prop
          : BackProp extends Claims
            ? Prop
            : Prop extends { items: infer I }
              ? {
                  items: { ref: Ref; prop: Claims } & Omit<I, 'ref' | 'prop'>
                } & Omit<Prop, 'items'>
              : Prop
        : never
      : Prop
    : Prop

type ValidateProps<Props, Types, TName extends string> = {
  [K in keyof Props]: ValidateProp<Props[K], Types, TName, K & string>
}

type ValidateSchema<S extends { types: any }> = Omit<S, 'types'> & {
  types: {
    [K in keyof S['types']]: S['types'][K] extends { props: infer P }
      ? {
          props: ValidateProps<P, S['types'], K & string>
          hooks?: SchemaHooks
        } & Omit<S['types'][K], 'props' | 'hooks'>
      : {
          [P in keyof S['types'][K]]: ValidateProp<
            S['types'][K][P],
            S['types'],
            K & string,
            P & string
          >
        }
  }
}

export type StrictSchema<S extends { types: any }> = S & ValidateSchema<S>

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type ResolveSchema<S extends { types: any }> = Prettify<
  Omit<SchemaOut, 'types' | 'locales'> & {
    types: {
      [K in keyof S['types']]: Prettify<
        Omit<NormalizeType<S['types'][K]>, 'props'> & {
          props: ResolvedProps<S['types'], K>
        }
      >
    }
    locales: S extends { locales: infer L }
      ? L extends readonly (infer K extends LangName)[]
        ? Partial<Record<K, SchemaLocale<true>>>
        : L extends Record<infer K, any>
          ? Partial<Record<K & LangName, SchemaLocale<true>>>
          : SchemaLocales<true>
      : SchemaLocales<true>
  }
>

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
export const parseSchema = <const S extends SchemaIn>(
  input: StrictSchema<S>,
): ResolveSchema<S> => {
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
      hash: v.hash,
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

    return result as unknown as ResolveSchema<S>
  } catch (e) {
    if (tracking) {
      e = Error(`${path.join('.')}: ${inspect(value)} - ${e}`, { cause: e })
    }
    throw e
  }
}
