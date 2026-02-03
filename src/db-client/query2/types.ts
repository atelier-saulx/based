type TypedArray =
  | Uint8Array
  | Float32Array
  | Int8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float64Array

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

type InferProp<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = Prop extends { type: 'text' }
  ? string
  : Prop extends { type: 'object'; props: infer P }
    ? InferType<P, Types, Locales>
    : Prop extends { type: infer T extends keyof TypeMap }
      ? TypeMap[T]
      : Prop extends { enum: infer E extends readonly any[] }
        ? E[number]
        : Prop extends { ref: string }
          ? number // ID
          : Prop extends { items: { ref: string } }
            ? number[] // IDs
            : unknown

type InferType<
  Props,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = {
  [K in keyof Props]: InferProp<Props[K], Types, Locales>
}

export type InferSchemaOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = InferType<
  S['types'][T]['props'],
  S['types'],
  S['locales'] extends Record<string, any> ? S['locales'] : {}
> & { id: number }

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
  K extends keyof Props | '*' | '**',
> = K extends '*' ? NonRefKeys<Props> : K extends '**' ? RefKeys<Props> : K

export type IncludeSelection<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K extends keyof S['types'][T]['props'] | '*',
> = ResolveInclude<S['types'][T]['props'], K>

export type PickOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
  K extends keyof S['types'][T]['props'],
> = Pick<InferSchemaOutput<S, T>, K | 'id'>
