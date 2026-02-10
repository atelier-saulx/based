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

export type FilterEdges<T> = {
  [K in keyof T as K extends `$${string}` ? K : never]: T[K]
}

// Utility to clean up intersection types
type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type PickOutputFromProps<
  S extends { types: any; locales?: any },
  Props,
  K,
> = Prettify<
  {
    [P in Extract<K, keyof Props & string> | 'id']: P extends 'id'
      ? number
      : P extends keyof Props
        ? IsRefProp<Props[P]> extends true
          ? Props[P] extends { items: any }
            ? { id: number }[]
            : { id: number }
          : InferProp<
              Props[P],
              S['types'],
              S['locales'] extends Record<string, any> ? S['locales'] : {}
            >
        : never
  } & {
    [Item in Extract<K, { field: any; select: any }> as Item['field'] &
      keyof Props]: InferProp<
      Props[Item['field'] & keyof Props],
      S['types'],
      S['locales'] extends Record<string, any> ? S['locales'] : {},
      Item['select']
    >
  }
>

export type InferProp<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
  Selection = never,
> = Prop extends { type: 'text' }
  ? { [K in keyof Locales]-?: string }
  : Prop extends { type: 'object'; props: infer P }
    ? InferType<P, Types, Locales>
    : Prop extends { type: infer T extends keyof TypeMap }
      ? TypeMap[T]
      : Prop extends { enum: infer E extends readonly any[] }
        ? E[number]
        : Prop extends { ref: infer R extends string }
          ? IsSelected<Selection> extends true
            ? R extends keyof Types
              ? PickOutputFromProps<
                  { types: Types; locales: Locales },
                  ResolvedProps<Types, R> & FilterEdges<Prop>,
                  ResolveInclude<
                    ResolvedProps<Types, R> & FilterEdges<Prop>,
                    Selection
                  >
                > | null
              : never
            : number // ID
          : Prop extends {
                items: { ref: infer R extends string } & infer Items
              }
            ? IsSelected<Selection> extends true
              ? R extends keyof Types
                ? PickOutputFromProps<
                    { types: Types; locales: Locales },
                    ResolvedProps<Types, R> & FilterEdges<Items>,
                    ResolveInclude<
                      ResolvedProps<Types, R> & FilterEdges<Items>,
                      Selection
                    >
                  >[]
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

export type ResolveInclude<Props, K> = K extends any
  ? K extends '*'
    ? NonRefKeys<Props>
    : K extends '**'
      ? RefKeys<Props>
      : K
  : never

export type IncludeSelection<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K,
> = ResolveInclude<ResolvedProps<S['types'], T>, K>

export type PickOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K,
> = Prettify<
  {
    [P in
      | Extract<K, keyof InferSchemaOutput<S, T>>
      | 'id']: P extends keyof ResolvedProps<S['types'], T>
      ? IsRefProp<ResolvedProps<S['types'], T>[P]> extends true
        ? InferProp<
            ResolvedProps<S['types'], T>[P],
            S['types'],
            S['locales'] extends Record<string, any> ? S['locales'] : {},
            '*'
          >
        : InferSchemaOutput<S, T>[P]
      : InferSchemaOutput<S, T>[P]
  } & {
    [Item in Extract<K, { field: any; select: any }> as Item['field'] &
      keyof ResolvedProps<S['types'], T>]: InferProp<
      ResolvedProps<S['types'], T>[Item['field'] &
        keyof ResolvedProps<S['types'], T>],
      S['types'],
      S['locales'] extends Record<string, any> ? S['locales'] : {},
      Item['select']
    >
  }
>

export type FilterOpts = {
  lowerCase?: boolean
  fn?:
    | 'dotProduct'
    | 'manhattanDistance'
    | 'cosineSimilarity'
    | 'euclideanDistance'
  score?: number
}

export type Operator =
  | '='
  | '<'
  | '>'
  | '!='
  | '>='
  | '<='
  | '..'
  | '!..'
  | 'exists'
  | '!exists'
  | 'like'
  | '!like'
  | 'includes'
  | '!includes'

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export type Path<Schema, T extends keyof Schema, Depth extends number = 5> = [
  Depth,
] extends [never]
  ? never
  : {
      [K in keyof ResolvedProps<Schema, T> & string]:
        | K
        | (ResolvedProps<Schema, T>[K] extends { ref: infer R extends string }
            ? `${K}.${
                | Path<Schema, R & keyof Schema, Prev[Depth]>
                | (keyof FilterEdges<ResolvedProps<Schema, T>[K]> & string)
                | 'id'}`
            : ResolvedProps<Schema, T>[K] extends {
                  items: { ref: infer R extends string } & infer Items
                }
              ? `${K}.${
                  | Path<Schema, R & keyof Schema, Prev[Depth]>
                  | (keyof FilterEdges<Items> & string)
                  | 'id'}`
              : never)
    }[keyof ResolvedProps<Schema, T> & string]

export type ResolveDotPath<T extends string> =
  T extends `${infer Head}.${infer Tail}`
    ? { field: Head; select: ResolveDotPath<Tail> }
    : T

export type InferPathType<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  P,
> = P extends 'id'
  ? number
  : P extends keyof ResolvedProps<S['types'], T>
    ? InferProp<ResolvedProps<S['types'], T>[P], S['types']>
    : P extends `${infer Head}.${infer Tail}`
      ? Head extends keyof ResolvedProps<S['types'], T>
        ? ResolvedProps<S['types'], T>[Head] extends {
            ref: infer R extends string
          }
          ? Tail extends keyof FilterEdges<ResolvedProps<S['types'], T>[Head]>
            ? InferProp<
                ResolvedProps<S['types'], T>[Head][Tail &
                  keyof ResolvedProps<S['types'], T>[Head]],
                S['types'],
                S['locales'] extends Record<string, any> ? S['locales'] : {}
              >
            : InferPathType<S, R & keyof S['types'], Tail>
          : ResolvedProps<S['types'], T>[Head] extends {
                items: { ref: infer R extends string } & infer Items
              }
            ? Tail extends keyof FilterEdges<Items>
              ? InferProp<
                  Items[Tail & keyof Items],
                  S['types'],
                  S['locales'] extends Record<string, any> ? S['locales'] : {}
                >
              : InferPathType<S, R & keyof S['types'], Tail>
            : never
        : never
      : never
