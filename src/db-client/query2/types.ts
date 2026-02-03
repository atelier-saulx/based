type TypedArray =
  | Uint8Array
  | Float32Array
  | Int8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float64Array
import type { ResolvedProps } from '../../schema/index.js'

export type InferSchemaOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = InferType<
  ResolvedProps<S['types'], T>,
  S['types'],
  S['locales'] extends Record<string, any> ? S['locales'] : {}
> & { id: number }

type TypeMap = {
  string: string
  number: number
  int8: number
  uint8: number
  int16: number
  uint16: number
  int32: number
  uint32: number
  boolean: boolean
  text: string
  json: any
  timestamp: number
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: number
}

// Helper to check if Selection is provided (not never/any/unknown default behavior)
type IsSelected<T> = [T] extends [never] ? false : true

type InferProp<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
  Selection = never,
> = Prop extends { type: 'text' }
  ? string
  : Prop extends { type: 'object'; props: infer P }
    ? InferType<P, Types, Locales>
    : Prop extends { type: infer T extends keyof TypeMap }
      ? TypeMap[T]
      : Prop extends { enum: infer E extends readonly any[] }
        ? E[number]
        : Prop extends { ref: infer R extends string }
          ? IsSelected<Selection> extends true
            ? R extends keyof Types
              ? PickOutput<{ types: Types; locales: Locales }, R, Selection>
              : never
            : number // ID
          : Prop extends { items: { ref: infer R extends string } }
            ? IsSelected<Selection> extends true
              ? R extends keyof Types
                ? PickOutput<{ types: Types; locales: Locales }, R, Selection>[]
                : never
              : number[] // IDs
            : unknown

type InferType<
  Props,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = {
  [K in keyof Props]: InferProp<Props[K], Types, Locales>
}

// Helpers for include
type IsRefProp<P> = P extends { type: 'reference' } | { type: 'references' }
  ? true
  : P extends { ref: any }
    ? true
    : P extends { items: { ref: any } }
      ? true
      : false

export type NonRefKeys<Props> = {
  [K in keyof Props]: IsRefProp<Props[K]> extends true ? never : K
}[keyof Props]

export type RefKeys<Props> = {
  [K in keyof Props]: IsRefProp<Props[K]> extends true ? K : never
}[keyof Props]

export type ResolveInclude<
  Props,
  K extends keyof Props | '*' | '**' | { field: any; select: any },
> = K extends any
  ? K extends '*'
    ? NonRefKeys<Props>
    : K extends '**'
      ? RefKeys<Props>
      : K
  : never

export type IncludeSelection<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K extends keyof ResolvedProps<S['types'], T> | '*',
> = ResolveInclude<ResolvedProps<S['types'], T>, K>

export type PickOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K,
> = {
  [P in
    | Extract<K, keyof InferSchemaOutput<S, T>>
    | 'id']: P extends keyof ResolvedProps<S['types'], T>
    ? IsRefProp<ResolvedProps<S['types'], T>[P]> extends true
      ? ResolvedProps<S['types'], T>[P] extends { items: any }
        ? { id: number }[]
        : { id: number }
      : InferSchemaOutput<S, T>[P]
    : InferSchemaOutput<S, T>[P]
} & {
  [Item in Extract<K, { field: any; select: any }> as Item['field']]: InferProp<
    ResolvedProps<S['types'], T>[Item['field']],
    S['types'],
    S['locales'] extends Record<string, any> ? S['locales'] : {},
    Item['select']
  >
}
