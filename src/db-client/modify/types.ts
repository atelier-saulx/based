import { type SchemaTypes } from '../../schema.js'

import type { BasedModify } from './index.js'

type TypedArray =
  | Uint8Array
  | Float32Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

type NumInc = number | { increment: number }

type TypeMap = {
  string: string
  number: NumInc
  int8: NumInc
  uint8: NumInc
  int16: NumInc
  uint16: NumInc
  int32: NumInc
  uint32: NumInc
  boolean: boolean
  text: string | Record<string, string>
  json: any
  timestamp: NumInc | string | Date
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: string | string[]
}

type EdgeKeys<T> = keyof T extends infer K
  ? K extends string
    ? string extends K
      ? never
      : K extends `$${string}`
        ? K
        : never
    : never
  : never

type InferEdgeProps<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = {
  [K in EdgeKeys<Prop>]?: Prop[K] extends keyof TypeMap
    ? TypeMap[Prop[K]]
    : InferProp<Prop[K], Types, Locales>
}

type InferRefValue<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> =
  | number
  | BasedModify<never>
  | (EdgeKeys<Prop> extends never
      ? { id: number | BasedModify<never> }
      : { id: number | BasedModify<never> } & InferEdgeProps<
          Prop,
          Types,
          Locales
        >)

type InferReferences<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> =
  | InferRefValue<Prop, Types, Locales>[]
  | {
      add?: Prettify<InferRefValue<Prop, Types, Locales>>[]
      update?: Prettify<InferRefValue<Prop, Types, Locales>>[]
      delete?: (number | BasedModify<never>)[]
    }

type InferProp<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = Prop extends { type: 'text' }
  ? string | Partial<Record<keyof Locales, string>>
  : Prop extends { type: 'object'; props: infer P }
    ? InferType<P, Types, Locales>
    : Prop extends { type: infer T extends keyof TypeMap }
      ? TypeMap[T]
      : Prop extends { enum: infer E extends readonly any[] }
        ? E[number]
        : Prop extends { ref: string }
          ? Prettify<InferRefValue<Prop, Types, Locales>>
          : Prop extends { items: { ref: string } }
            ? Prettify<InferReferences<Prop['items'], Types, Locales>>
            : never

type Prettify<Target> = Target extends any
  ? Target extends (infer U)[]
    ? Prettify<U>[]
    : Target extends BasedModify<any>
      ? Target
      : Target extends object
        ? {
            -readonly [K in keyof Target]: Target[K]
          }
        : Target
  : never

type InferType<
  Props,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = Prettify<
  {
    [K in keyof Props as Props[K] extends { required: true }
      ? K
      : never]: InferProp<Props[K], Types, Locales>
  } & {
    [K in keyof Props as Props[K] extends { required: true }
      ? never
      : K]?: InferProp<Props[K], Types, Locales> | null
  }
>

export type InferPayload<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = InferType<
  S['types'][T]['props'],
  S['types'],
  S['locales'] extends Record<string, any> ? S['locales'] : {}
>

type InferAliasProps<Props> = {
  [K in keyof Props as Props[K] extends { type: 'alias' } ? K : never]?: string
}

export type InferTarget<
  S extends { types: any },
  T extends keyof S['types'],
> = InferAliasProps<S['types'][T]['props']>
