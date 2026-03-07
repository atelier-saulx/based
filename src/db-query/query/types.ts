import type { ResolvedProps } from '../../schema/index.js'
import type { TypedArray } from '../../schema/index.js'

export type GetLocales<S extends { locales?: any }> = S['locales'] extends
  | string
  | Record<string, any>
  ? S['locales']
  : {}

export type InferSchemaOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = InferType<ResolvedProps<S['types'], T>, S> & { id: number }

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
  json: any
  timestamp: number
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: number
}

type LocalizedString = { type: 'string'; localized: true }

// Helper to check if Selection is provided (not never/any/unknown default behavior)
type IsSelected<T> = [T] extends [never] ? false : true

export type FilterEdges<T> = {
  [K in keyof T as K extends `$${string}` ? K : never]: T[K]
}

// Utility to clean up intersection types
type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type PickOutputFromProps<
  S extends { types: any; locales?: any },
  Props,
  K,
> = Prettify<
  {
    [P in Extract<K, keyof Props & string> | 'id']: P extends 'id'
      ? number
      : P extends keyof Props
        ? IsRefProp<Props[P]> extends true
          ? InferProp<Props[P], S, '*'>
          : InferProp<Props[P], S>
        : never
  } & {
    [Field in Extract<K, { field: any; select: any }>['field'] &
      keyof Props]: InferProp<
      Props[Field],
      S,
      Extract<K, { field: Field; select: any }>['select']
    >
  }
>

export type InferProp<
  Prop,
  S extends { types: any; locales?: any },
  Selection = never,
> =
  IsSelected<Selection> extends false
    ? InferPropLogic<Prop, S, Selection>
    : [Selection] extends [{ _aggregate: infer Agg }]
      ? Agg
      : InferPropLogic<Prop, S, Selection>

type InferPropLogic<
  Prop,
  S extends { types: any; locales?: any },
  Selection = never,
> = Prop extends LocalizedString
  ? GetLocales<S> extends string
    ? string
    : { [K in Exclude<keyof GetLocales<S>, symbol | number>]-?: string }
  : Prop extends { type: 'object'; props: infer P }
    ? InferType<P, S>
    : Prop extends { type: infer T extends keyof TypeMap }
      ? TypeMap[T]
      : Prop extends { enum: infer E extends readonly any[] }
        ? E[number] | null
        : Prop extends { ref: infer R extends string }
          ? IsSelected<Selection> extends true
            ? R extends keyof S['types']
              ? PickOutputFromProps<
                  S,
                  ResolvedProps<S['types'], R> & FilterEdges<Prop>,
                  ResolveInclude<
                    ResolvedProps<S['types'], R> & FilterEdges<Prop>,
                    Selection
                  >
                > | null
              : never
            : number // ID
          : Prop extends {
                items: { ref: infer R extends string } & infer Items
              }
            ? IsSelected<Selection> extends true
              ? R extends keyof S['types']
                ? PickOutputFromProps<
                    S,
                    ResolvedProps<S['types'], R> & FilterEdges<Items>,
                    ResolveInclude<
                      ResolvedProps<S['types'], R> & FilterEdges<Items>,
                      Selection
                    >
                  >[]
                : never
              : number[] // IDs
            : unknown

type InferType<Props, S extends { types: any; locales?: any }> = {
  [K in keyof Props]: InferProp<Props[K], S>
}

// Helpers for include
type IsRefProp<P> = [P] extends [{ type: 'reference' } | { type: 'references' }]
  ? true
  : [P] extends [{ ref: any }]
    ? true
    : [P] extends [{ items: { ref: any } }]
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

export type PickOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K,
> = PickOutputFromProps<S, ResolvedProps<S['types'], T>, K>

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

// Helper to generate paths from edges
type EdgePaths<
  S extends { types: any; locales?: any },
  Prop,
  Depth extends number,
> = {
  [K in keyof FilterEdges<Prop> & string]:
    | K
    | (FilterEdges<Prop>[K] extends { ref: infer R extends string }
        ? `${K}.${Path<S, R & keyof S['types'], Depth> | 'id' | '*' | '**'}`
        : FilterEdges<Prop>[K] extends {
              items: { ref: infer R extends string }
            }
          ? `${K}.${Path<S, R & keyof S['types'], Depth> | 'id' | '*' | '**'}`
          : never)
}[keyof FilterEdges<Prop> & string]

type PropsPath<
  S extends { types: any; locales?: any },
  Props,
  Depth extends number,
> = [Depth] extends [never]
  ? never
  : {
      [K in keyof Props & string]:
        | K
        | (Props[K] extends { ref: infer R extends string }
            ? `${K}.${
                | Path<S, R & keyof S['types'], Prev[Depth]>
                | EdgePaths<S, Props[K], Prev[Depth]>
                | 'id'
                | '*'
                | '**'}`
            : Props[K] extends { props: infer P }
              ? `${K}.${PropsPath<S, P, Prev[Depth]>}`
              : Props[K] extends LocalizedString
                ? S['locales'] extends string
                  ? never
                  : `${K}.${keyof GetLocales<S> & string}`
                : Props[K] extends {
                      items: { ref: infer R extends string } & infer Items
                    }
                  ? `${K}.${
                      | Path<S, R & keyof S['types'], Prev[Depth]>
                      | EdgePaths<S, Items, Prev[Depth]>
                      | 'id'
                      | '*'
                      | '**'}`
                  : never)
    }[keyof Props & string]

export type Path<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  Depth extends number = 5,
> = PropsPath<S, ResolvedProps<S['types'], T>, Depth>

export type ResolveDotPath<T extends string> =
  T extends `${infer Head}.${infer Tail}`
    ? { field: Head; select: ResolveDotPath<Tail> }
    : T

type InferPropsPathType<
  S extends { types: any; locales?: any },
  Props,
  P,
> = P extends 'id'
  ? number
  : P extends keyof Props
    ? InferProp<Props[P], S>
    : P extends `${infer Head}.${infer Tail}`
      ? Head extends keyof Props
        ? Props[Head] extends { ref: infer R extends string }
          ? Tail extends keyof FilterEdges<Props[Head]>
            ? InferProp<Props[Head][Tail & keyof Props[Head]], S>
            : InferPathType<S, R & keyof S['types'], Tail>
          : Props[Head] extends { props: infer NestedProps }
            ? InferPropsPathType<S, NestedProps, Tail>
            : Props[Head] extends LocalizedString
              ? S['locales'] extends string
                ? never
                : Tail extends keyof GetLocales<S>
                  ? string
                  : never
              : Props[Head] extends {
                    items: { ref: infer R extends string } & infer Items
                  }
                ? Tail extends keyof FilterEdges<Items>
                  ? InferProp<Items[Tail & keyof Items], S>
                  : InferPathType<S, R & keyof S['types'], Tail>
                : never
        : never
      : never

export type InferPathType<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  P,
  EdgeProps extends Record<string, any> = {},
> = InferPropsPathType<S, ResolvedProps<S['types'], T> & EdgeProps, P>

export type NumberPaths<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = {
  [K in Path<S, T>]: InferPathType<S, T, K> extends number ? K : never
}[Path<S, T>]

export type SortablePaths<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  EdgeProps extends Record<string, any> = {},
> = {
  [K in Path<S, T>]: InferPathType<S, T, K, EdgeProps> extends
    | string
    | number
    | Uint8Array
    | boolean
    | null
    ? K
    : never
}[Path<S, T>]

export type ExpandDotPath<
  T extends string,
  V,
> = T extends `${infer Head}.${infer Tail}`
  ? { [K in Head]: ExpandDotPath<Tail, V> }
  : { [K in T]: V }

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never
